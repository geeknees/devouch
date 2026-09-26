// ABOUTME: Creates real official ENSv2 subregistries and independent recommendation records.
// ABOUTME: Uses direct contract calls so integration tests do not inherit the reader's traversal assumptions.
import { encodeFunctionData, keccak256, namehash, parseEventLogs, toHex, zeroAddress, type Abi, type Address, type Hex } from 'viem';
import { packetToBytes } from 'viem/ens';
import registryArtifact from '../../vendor/ens-v2/UserRegistryImpl.json';
import { ETH_REGISTRY, FACTORY, OWNER_ROLES, RESOLVER_IMPL, factoryAbi, resolverAbi } from '../../src/ens';
import { domain, parseCredential, typedData } from '../../src/credential';
import { ChainReader } from '../../src/chain';
import { makeRequest } from '../../src/operations';
import { issuer, publicClient, setupEvm, settle, testRpc, wallet } from './evm';

export const userRegistryAbi = registryArtifact.abi as Abi;
export const registryRoles = BigInt('0x' + '1'.repeat(64));
export const labelId = (label: string) => BigInt(keccak256(toHex(label)));
export const textData = (name: string, value: string, key = 'devouch.vouch') => encodeFunctionData({
  abi: resolverAbi, functionName: 'setText', args: [toHex(packetToBytes(name)), key, value],
});
export async function send(to: Address, data: Hex) {
  const hash = await wallet.sendTransaction({ to, data });
  return publicClient.waitForTransactionReceipt({ hash });
}
export async function registryCall(registry: Address, functionName: string, args: unknown[]) {
  return send(registry, encodeFunctionData({ abi: userRegistryAbi, functionName, args }));
}
async function proxy(implementation: Address, initialization: Hex) {
  const receipt = await send(FACTORY, encodeFunctionData({ abi: factoryAbi, functionName: 'deployProxy',
    args: [implementation, BigInt(toHex(crypto.getRandomValues(new Uint8Array(32)))), initialization] }));
  const event = parseEventLogs({ abi: factoryAbi, eventName: 'ProxyDeployed', logs: receipt.logs })[0]!;
  return { address: event.args.proxyAddress, origin: receipt.blockNumber };
}
export async function createRegistry(parent: Address, label: string) {
  const created = await proxy(registryArtifact.address as Address, encodeFunctionData({ abi: userRegistryAbi,
    functionName: 'initialize', args: [[{ account: issuer.address, roleBitmap: registryRoles }]] }));
  await registryCall(created.address, 'setParent', [parent, label]);
  return created.address;
}
export async function createLeaf(registry: Address, namespace: string, subjectId: string) {
  const name = `${subjectId}.${namespace}`;
  const created = await proxy(RESOLVER_IMPL, encodeFunctionData({ abi: resolverAbi, functionName: 'initialize',
    args: [[{ account: issuer.address, roleBitmap: OWNER_ROLES }], [textData(name, '')]] }));
  await registryCall(registry, 'register', [subjectId, issuer.address, zeroAddress, created.address,
    registryRoles, (await publicClient.getBlock()).timestamp + 86400n]);
  return { name, resolver: created.address, origin: created.origin, node: namehash(name), subject: `github:${subjectId}` };
}
export async function setupHierarchy() {
  const parent = await setupEvm();
  const parentLabel = parent.name.split('.')[0]!;
  const parentRegistry = await createRegistry(ETH_REGISTRY, parentLabel);
  await registryCall(ETH_REGISTRY, 'setSubregistry', [labelId(parentLabel), parentRegistry]);
  const namespace = `vouches.${parent.name}`;
  const registry = await createRegistry(parentRegistry, 'vouches');
  await registryCall(parentRegistry, 'register', ['vouches', issuer.address, registry, zeroAddress,
    registryRoles, (await publicClient.getBlock()).timestamp + 86400n]);
  const leaves = [await createLeaf(registry, namespace, '287365775'), await createLeaf(registry, namespace, '701242')];
  await settle();
  return { parent, parentLabel, parentRegistry, namespace, registry, leaves };
}
export async function issueLeaf(leaf: Awaited<ReturnType<typeof createLeaf>>) {
  await settle();
  const reader = new ChainReader(testRpc);
  const request = await makeRequest({ name: leaf.name, issuer: issuer.address, subject: leaf.subject,
    expiresAt: ((await publicClient.getBlock()).timestamp + 3600n).toString() }, reader);
  const raw = JSON.stringify({ formatVersion: 1, domain: domain(request.message), endorsement: {
    message: request.message, signature: await issuer.signTypedData(typedData(request.message)) } });
  const receipt = await send(leaf.resolver, textData(leaf.name, raw));
  await settle();
  return { request, raw, parsed: await parseCredential(raw), receipt };
}
