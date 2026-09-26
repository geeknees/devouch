// ABOUTME: Verifies portable endorsements through real ENSv2 parent and subregistry histories.
// ABOUTME: Tests independent withdrawal and permanent rejection after authority changes are restored.
import { expect, test } from 'bun:test';
import { createWalletClient, encodeFunctionData, http, toHex, zeroAddress, type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { ChainReader } from '../../src/chain';
import { domain, parseCredential, typedData } from '../../src/credential';
import { ETH_REGISTRY, RESOLVER_IMPL, USER_REGISTRY_IMPL, registryAbi } from '../../src/ens';
import { makeRequest } from '../../src/operations';
import { issuer, publicClient, rpc, settle, testRpc, wallet } from '../support/evm';
import { createLeaf, createRegistry, issueLeaf, labelId, registryCall, registryRoles, send, setupHierarchy, textData, userRegistryAbi } from '../support/hierarchy';

test('two subname endorsements remain independent when one is withdrawn and its old JSON restored', async () => {
  const fixture = await setupHierarchy();
  const first = await issueLeaf(fixture.leaves[0]!);
  const second = await issueLeaf(fixture.leaves[1]!);
  const reader = new ChainReader(testRpc);
  expect((await reader.inspect(first.parsed)).evidence_status).toBe('valid');
  expect((await reader.inspect(second.parsed)).evidence_status).toBe('valid');
  const fetched = await reader.fetch(fixture.leaves[0]!.name);
  expect(fetched.raw).toBe(first.raw);
  await send(fixture.leaves[0]!.resolver, textData(fixture.leaves[0]!.name, ''));
  await send(fixture.leaves[0]!.resolver, textData(fixture.leaves[0]!.name, first.raw));
  await settle();
  expect((await reader.inspect(first.parsed)).evidence_status).toBe('revoked');
  expect((await reader.fetch(fixture.leaves[0]!.name, fetched.publication)).raw).toBe(first.raw);
  expect((await reader.inspect(second.parsed)).evidence_status).toBe('valid');
}, 120000);

test('restoring a parent subregistry cannot revive its existing endorsements', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  const reader = new ChainReader(testRpc);
  const publication = (await reader.inspect(signed.parsed)).publication!;
  const other = await createRegistry(ETH_REGISTRY, fixture.parentLabel);
  await registryCall(ETH_REGISTRY, 'setSubregistry', [labelId(fixture.parentLabel), other]);
  await registryCall(ETH_REGISTRY, 'setSubregistry', [labelId(fixture.parentLabel), fixture.parentRegistry]);
  await settle();
  expect((await reader.inspect(signed.parsed)).evidence_status).toBe('invalid');
  expect((await reader.fetch(fixture.leaves[0]!.name, publication)).raw).toBe(signed.raw);
}, 120000);

test('restoring a subregistry parent pointer cannot revive an existing endorsement', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  await registryCall(fixture.registry, 'setParent', [zeroAddress, '']);
  await registryCall(fixture.registry, 'setParent', [fixture.parentRegistry, 'vouches']);
  await settle();
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('invalid');
}, 120000);

test('revoking and restoring a parent controller role invalidates old endorsements', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  const setSubregistry = 1n << 20n;
  await registryCall(ETH_REGISTRY, 'revokeRoles', [labelId(fixture.parentLabel), setSubregistry, issuer.address]);
  await registryCall(ETH_REGISTRY, 'grantRoles', [labelId(fixture.parentLabel), setSubregistry, issuer.address]);
  await settle();
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('invalid');
}, 120000);

test('a sibling name role change does not invalidate a different endorsement', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  const delegate = privateKeyToAccount(generatePrivateKey());
  await registryCall(fixture.registry, 'grantRoles', [labelId('701242'), 1n << 24n, delegate.address]);
  await settle();
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('valid');
}, 120000);

test('an unrelated direct .eth label cannot be confused with the same leaf label in another registry', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  await registryCall(ETH_REGISTRY, 'register', ['287365775', issuer.address, zeroAddress, zeroAddress,
    registryRoles, (await publicClient.getBlock()).timestamp + 86400n]);
  await settle();
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('valid');
}, 120000);

test('parent ownership transfer and return cannot resurrect a descendant endorsement', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  const other = privateKeyToAccount(generatePrivateKey());
  await rpc('hardhat_setBalance', [other.address, toHex(10n ** 18n)]);
  const state = await publicClient.readContract({ address: ETH_REGISTRY, abi: registryAbi,
    functionName: 'getState', args: [labelId(fixture.parentLabel)] });
  await registryCall(ETH_REGISTRY, 'unsafeTransfer', [other.address, state.tokenId, '0x']);
  const moved = await publicClient.readContract({ address: ETH_REGISTRY, abi: registryAbi,
    functionName: 'getState', args: [labelId(fixture.parentLabel)] });
  expect(moved.latestOwner).toBe(other.address);
  const secondWallet = createWalletClient({ account: other, chain: sepolia, transport: http(testRpc) });
  const hash = await secondWallet.writeContract({ address: ETH_REGISTRY, abi: userRegistryAbi,
    functionName: 'unsafeTransfer', args: [issuer.address, moved.tokenId, '0x'] });
  await publicClient.waitForTransactionReceipt({ hash }); await settle();
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('invalid');
}, 120000);

test('re-registering an intermediate name with the same owner and registry invalidates prior endorsements', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  await registryCall(fixture.parentRegistry, 'unregister', [labelId('vouches')]);
  await registryCall(fixture.parentRegistry, 'register', ['vouches', issuer.address, fixture.registry, zeroAddress,
    registryRoles, (await publicClient.getBlock()).timestamp + 86400n]);
  await settle();
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('invalid');
}, 120000);

test('root role grants and revocations on a subregistry remain visible after restoration', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  const delegate = privateKeyToAccount(generatePrivateKey());
  await registryCall(fixture.registry, 'grantRootRoles', [1n << 24n, delegate.address]);
  await registryCall(fixture.registry, 'revokeRootRoles', [1n << 24n, delegate.address]);
  await settle();
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('invalid');
}, 120000);

test('a subregistry upgrade cannot be hidden by restoring the original implementation', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  await registryCall(fixture.registry, 'upgradeToAndCall', [USER_REGISTRY_IMPL, '0x']);
  await settle();
  await expect(new ChainReader(testRpc).inspect(signed.parsed)).rejects.toThrow('registry_upgraded');
  await expect(new ChainReader(testRpc).prepare(fixture.leaves[0]!.name, issuer.address)).rejects.toThrow('registry_upgraded');
}, 120000);

test('endorsement expiry cannot exceed the shortest ancestor lease', async () => {
  const fixture = await setupHierarchy();
  const shortRegistry = await createRegistry(fixture.parentRegistry, 'short');
  await registryCall(fixture.parentRegistry, 'register', ['short', issuer.address, shortRegistry, zeroAddress,
    registryRoles, (await publicClient.getBlock()).timestamp + 300n]);
  const leaf = await createLeaf(shortRegistry, `short.${fixture.parent.name}`, '123');
  await expect(issueLeaf(leaf)).rejects.toThrow('name_expires_before_endorsement');
}, 120000);

test('a change and restoration after publication in the same block is still invalid', async () => {
  const fixture = await setupHierarchy(), leaf = fixture.leaves[0]!;
  const request = await makeRequest({ name: leaf.name, issuer: issuer.address, subject: leaf.subject,
    expiresAt: ((await publicClient.getBlock()).timestamp + 3600n).toString() }, new ChainReader(testRpc));
  const raw = JSON.stringify({ formatVersion: 1, domain: domain(request.message), endorsement: {
    message: request.message, signature: await issuer.signTypedData(typedData(request.message)) } });
  const calls: { to: Address; data: Hex }[] = [{ to: leaf.resolver, data: textData(leaf.name, raw) },
    ...[zeroAddress, fixture.parentRegistry].map(subregistry => ({ to: ETH_REGISTRY,
      data: encodeFunctionData({ abi: registryAbi, functionName: 'setSubregistry', args: [labelId(fixture.parentLabel), subregistry] }) }))];
  const hashes: Hex[] = [];
  await rpc('evm_setAutomine', [false]);
  try {
    const nonce = await publicClient.getTransactionCount({ address: issuer.address, blockTag: 'pending' });
    for (const [index, call] of calls.entries()) hashes.push(await wallet.sendTransaction({ ...call, nonce: nonce + index, gas: 1500000n }));
    await rpc('evm_mine');
  } finally { await rpc('evm_setAutomine', [true]); }
  const receipts = await Promise.all(hashes.map(hash => publicClient.getTransactionReceipt({ hash })));
  expect(receipts.every(receipt => receipt.status === 'success' && receipt.blockNumber === receipts[0]!.blockNumber)).toBe(true);
  await settle();
  expect((await new ChainReader(testRpc).inspect(await parseCredential(raw))).evidence_status).toBe('invalid');
}, 120000);

test('an unrelated implementation cannot masquerade as a supported subregistry', async () => {
  const fixture = await setupHierarchy();
  await registryCall(ETH_REGISTRY, 'setSubregistry', [labelId(fixture.parentLabel), fixture.leaves[0]!.resolver]);
  await settle();
  expect(RESOLVER_IMPL).not.toBe(USER_REGISTRY_IMPL);
  await expect(new ChainReader(testRpc).prepare(fixture.leaves[0]!.name, issuer.address)).rejects.toThrow('unsupported_implementation');
}, 120000);

test('missing subregistry history is unavailable instead of accepted', async () => {
  const fixture = await setupHierarchy();
  const signed = await issueLeaf(fixture.leaves[0]!);
  let refused = 0;
  const limited = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    const input = await request.json() as { id: number; method: string; params: unknown[] };
    if (input.method === 'eth_getLogs' && JSON.stringify(input.params).toLowerCase().includes(fixture.registry.toLowerCase())) {
      refused++;
      return Response.json({ jsonrpc: '2.0', id: input.id, error: { code: -32000, message: 'Historical logs unavailable' } });
    }
    const upstream = await fetch(testRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    return new Response(await upstream.text(), { headers: { 'content-type': 'application/json' } });
  } });
  try {
    await expect(new ChainReader(limited.url.toString()).inspect(signed.parsed)).rejects.toThrow('rpc_unavailable');
    expect(refused).toBeGreaterThan(0);
  } finally { await limited.stop(true); }
}, 120000);
