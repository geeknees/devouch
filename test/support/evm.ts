// ABOUTME: Installs pinned official ENS bytecode in a disposable local Hardhat chain.
// ABOUTME: Constructor storage is copied only for fixed protocol addresses; issuer operations are real transactions.
import { createPublicClient, createWalletClient, encodeFunctionData, getAddress, http, parseEventLogs,
  toHex, zeroAddress, type Abi, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { DEPLOYMENTS, DEPLOYMENT_BLOCK, ETH_REGISTRY, FACTORY, OWNER_ROLES, RESOLVER_IMPL, ROOT_REGISTRY,
  factoryAbi, resolverAbi, setTextData } from '../../src/ens';
import labelStore from '../../vendor/ens-v2/LabelStore.json';
import userRegistry from '../../vendor/ens-v2/UserRegistryImpl.json';

export const testRpc = process.env.DEVOUCH_TEST_RPC!;
if (!testRpc || !testRpc.startsWith('http://127.0.0.1:')) throw new Error('Run node scripts/test-integration.ts');
const transport = http(testRpc, { retryCount: 0, timeout: 15000 });
export const issuer = privateKeyToAccount(generatePrivateKey());
export const publicClient = createPublicClient({ chain: sepolia, transport, pollingInterval: 30 });
export const wallet = createWalletClient({ account: issuer, chain: sepolia, transport });
export async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(testRpc, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const result = await response.json() as { result: unknown; error?: { message: string } };
  if (result.error) throw new Error(result.error.message);
  return result.result;
}
export async function settle() { await rpc('hardhat_mine', ['0x2', '0x0']); }

async function deploy(artifact: { abi: unknown[]; bytecode: string }, args: unknown[] = []) {
  let hash: Hex;
  try { hash = await wallet.deployContract({ abi: artifact.abi as Abi, bytecode: artifact.bytecode as Hex, args }); }
  catch (error) { throw new Error(`Fixture deployment failed: ${(error as { details?: string }).details ?? 'EVM reverted'}`); }
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('fixture deployment failed');
  return { address: receipt.contractAddress, hash };
}

async function install(artifact: typeof DEPLOYMENTS.resolver | typeof DEPLOYMENTS.factory | typeof DEPLOYMENTS.root | typeof userRegistry, args: unknown[]) {
  const deployed = await deploy(artifact, args);
  const target = getAddress(artifact.address);
  let code = (await publicClient.getCode({ address: deployed.address }))!;
  // UUPS self-address immutables must describe the fixed address used by this fixture.
  if ([getAddress(RESOLVER_IMPL), getAddress(userRegistry.address)].includes(target)) {
    for (const offsets of Object.values(artifact.immutableReferences)) for (const offset of offsets) {
      const from = 2 + offset.start * 2;
      if (code.slice(from, from + offset.length * 2).toLowerCase() === deployed.address.slice(2).toLowerCase().padStart(offset.length * 2, '0')) {
        code = (code.slice(0, from) + target.slice(2).padStart(offset.length * 2, '0') + code.slice(from + offset.length * 2)) as Hex;
      }
    }
  }
  await rpc('hardhat_setCode', [target, code]);
  const trace = await rpc('debug_traceTransaction', [deployed.hash, { disableMemory: true, disableStorage: true }]) as {
    structLogs: { op: string; depth: number; stack: string[] }[] };
  const slots = new Set(trace.structLogs.filter(row => row.op === 'SSTORE' && row.depth === 1).map(row => `0x${row.stack.at(-1)!.replace(/^0x/, '').padStart(64, '0')}`));
  for (const slot of slots) {
    const value = await publicClient.getStorageAt({ address: deployed.address, slot: slot as Hex });
    await rpc('hardhat_setStorageAt', [target, slot, value ?? `0x${'0'.repeat(64)}`]);
  }
  return target;
}

let installed = false;
export async function setupEvm() {
  await rpc('hardhat_setBalance', [issuer.address, toHex(100n * 10n ** 18n)]);
  if (!installed) {
    const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
    if (latest < DEPLOYMENT_BLOCK + 100n) await rpc('hardhat_mine', [toHex(DEPLOYMENT_BLOCK + 100n - latest), '0x0']);
    const labels = await deploy(labelStore, [issuer.address]);
    const allRoles = BigInt(`0x${'1'.repeat(64)}`);
    await install(DEPLOYMENTS.root, [labels.address, issuer.address, allRoles]);
    await install(DEPLOYMENTS.eth, [labels.address, issuer.address, allRoles]);
    await install(DEPLOYMENTS.factory, []);
    await install(DEPLOYMENTS.resolver, [issuer.address]);
    await install(userRegistry, [labels.address, issuer.address]);
    const expiry = (await publicClient.getBlock()).timestamp + 86400n * 365n;
    const hash = await wallet.writeContract({ address: ROOT_REGISTRY, abi: DEPLOYMENTS.root.abi as Abi, functionName: 'register',
      args: ['eth', issuer.address, ETH_REGISTRY, zeroAddress, allRoles, expiry] });
    await publicClient.waitForTransactionReceipt({ hash });
    installed = true;
  }
  const label = `devouch-${crypto.randomUUID().slice(0, 8)}`;
  const name = `${label}.eth`;
  const initialization = encodeFunctionData({ abi: resolverAbi, functionName: 'initialize',
    args: [[{ account: issuer.address, roleBitmap: OWNER_ROLES }], [setTextData(name, '')]] });
  const hash = await wallet.writeContract({ address: FACTORY, abi: factoryAbi, functionName: 'deployProxy',
    args: [RESOLVER_IMPL, BigInt(`0x${crypto.randomUUID().replaceAll('-', '')}`), initialization] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const deployment = parseEventLogs({ abi: factoryAbi, eventName: 'ProxyDeployed', logs: receipt.logs })[0];
  if (!deployment) throw new Error('missing fixture proxy');
  const resolver = deployment.args.proxyAddress;
  const register = await wallet.writeContract({ address: ETH_REGISTRY, abi: DEPLOYMENTS.eth.abi as Abi, functionName: 'register',
    args: [label, issuer.address, zeroAddress, resolver, BigInt(`0x${'1'.repeat(64)}`), (await publicClient.getBlock()).timestamp + 86400n * 365n] });
  await publicClient.waitForTransactionReceipt({ hash: register });
  return { name, resolver, origin: receipt.blockNumber };
}
