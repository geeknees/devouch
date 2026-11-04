// ABOUTME: Deploys unmodified upstream registries and OpenZeppelin proxies on a disposable local EVM.
// ABOUTME: Uses unlocked fixture accounts and impersonates only the upstream bootstrap owner locally.
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi, sha256, stringToHex,
  toHex, type Abi, type Address, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { Erc8004Reader, feedbackDataURI, identityAbi, reputationAbi, MAPPING_KEY, type FeedbackReference } from '../../src/erc8004';
import type { Erc8004Policy } from '../../src/erc8004-policy';
import identity from '../../vendor/erc-8004/IdentityRegistryUpgradeable.json';
import reputation from '../../vendor/erc-8004/ReputationRegistryUpgradeable.json';
import minimal from '../../vendor/erc-8004/MinimalUUPS.json';
import proxy from '../../vendor/erc-8004/ERC1967Proxy.json';

export async function setupErc8004(url = process.env.DEVOUCH_TEST_RPC!, fixedTime = true) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw new Error('Local EVM required');
  const rpc = async (method: string, params: unknown[] = []) => {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const json = await response.json() as { result: unknown; error?: unknown };
    if (json.error) throw new Error('Local fixture RPC failed');
    return json.result;
  };
  const accounts = await rpc('eth_accounts') as Address[];
  const [owner, evaluator, operator, successor] = accounts as [Address, Address, Address, Address];
  const transport = http(url, { retryCount: 0, timeout: 15000 });
  const client = createPublicClient({ chain: sepolia, transport, pollingInterval: 10 });
  if (fixedTime && (await client.getBlockNumber({ cacheTime: 0 })) === 0n) await rpc('evm_setNextBlockTimestamp', [2000000000]);
  const wallet = (account: Address) => createWalletClient({ account, chain: sepolia, transport });
  const receipt = (hash: Hex) => client.waitForTransactionReceipt({ hash });
  const write = async (account: Address, address: Address, abi: Abi, functionName: string, args: unknown[] = []) => {
    const result = await receipt(await wallet(account).writeContract({ address, abi, functionName, args }));
    if (result.status !== 'success') throw new Error('Local fixture transaction reverted');
    return result;
  };
  const deploy = async (artifact: { abi: unknown[]; bytecode: string }, args: unknown[] = []) => {
    const result = await receipt(await wallet(owner).deployContract({ abi: artifact.abi as Abi, bytecode: artifact.bytecode as Hex, args }));
    if (result.status !== 'success' || !result.contractAddress) throw new Error('Fixture deployment reverted');
    return result.contractAddress;
  };
  // The official MinimalUUPS source has a fixed bootstrap owner. No private key is needed in this local fixture.
  const bootstrapOwner: Address = '0x547289319C3e6aedB179C0b8e8aF0B5ACd062603';
  await rpc('hardhat_impersonateAccount', [bootstrapOwner]);
  await rpc('hardhat_setBalance', [bootstrapOwner, toHex(10n ** 20n)]);
  const bootstrap = await deploy(minimal);
  const upgradeAbi = parseAbi(['function upgradeToAndCall(address newImplementation, bytes data) payable']);
  const registry = async (artifact: typeof identity | typeof reputation, args: unknown[]) => {
    const implementation = await deploy(artifact);
    const address = await deploy(proxy, [bootstrap, encodeFunctionData({ abi: minimal.abi, functionName: 'initialize',
      args: [args[0] ?? '0x0000000000000000000000000000000000000000'] })]);
    await write(bootstrapOwner, address, upgradeAbi, 'upgradeToAndCall', [implementation,
      encodeFunctionData({ abi: artifact.abi as Abi, functionName: 'initialize', args })]);
    return address;
  };
  const identityRegistry = await registry(identity, []), reputationRegistry = await registry(reputation, [identityRegistry]);
  await write(owner, identityRegistry, identityAbi, 'register');
  const agentId = 0n, subject = 'github:12345';
  await write(owner, identityRegistry, identityAbi, 'setMetadata', [agentId, MAPPING_KEY, stringToHex(subject)]);
  await write(owner, identityRegistry, identityAbi, 'approve', [operator, agentId]);
  const issuedAt = (await client.getBlock()).timestamp.toString();
  const data = { format: 'devouch-feedback-v1', subject, owner, scope: 'oss-contribution', issuedAt,
    expiresAt: (BigInt(issuedAt) + 3600n).toString() };
  const raw = JSON.stringify(data);
  const feedbackArgs = [agentId, 1n, 0, data.scope, data.format, '', feedbackDataURI(raw), sha256(stringToHex(raw))];
  const published = await write(evaluator, reputationRegistry, reputationAbi, 'giveFeedback', feedbackArgs);
  const reference: FeedbackReference = { format: 'devouch-erc8004-v1', chainId: 11155111, identityRegistry,
    reputationRegistry, agentId: '0', clientAddress: evaluator, feedbackIndex: '1', feedbackBlock: published.blockNumber.toString() };
  const reader = new Erc8004Reader(client);
  const pin = await reader.registryPin(identityRegistry, reputationRegistry, published.blockNumber);
  const policy: Erc8004Policy = { format: 'devouch-erc8004-policy-v1', repositoryId: 'example/a', chainId: 11155111,
    trustedIssuers: [evaluator], allowedScopes: [data.scope], allowedRegistries: [pin], requiredIssuers: 1 };
  const observe = () => client.getBlockNumber({ cacheTime: 0 });
  return { rpc, client, wallet, write, owner, evaluator, operator, successor, identityRegistry, reputationRegistry,
    bootstrapOwner, upgradeAbi, bootstrap, agentId, subject, data, feedbackArgs, reference, reader, policy, observe };
}
