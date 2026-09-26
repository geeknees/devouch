// ABOUTME: Compares the frozen v0.1 distribution and current verifier on identical real ENS state.
// ABOUTME: Separates preserved direct-name behavior from deliberately stricter authority checks.
import { beforeAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createWalletClient, encodeFunctionData, http, keccak256, toHex, zeroAddress, type Abi, type Address } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import resolverArtifact from '../../vendor/ens-v2/PermissionedResolverImpl.json';
import provenance from '../fixtures/v0.1/provenance.json';
import { execute } from '../../src/bridge';
import { ChainReader } from '../../src/chain';
import { domain, typedData } from '../../src/credential';
import { ETH_REGISTRY, ROLE_TEXT, nameParts, resolverAbi, setTextData } from '../../src/ens';
import { makeRequest } from '../../src/operations';
import { issuer, publicClient, rpc, setupEvm, settle, testRpc } from '../support/evm';
import { issueLeaf, registryCall, send, setupHierarchy } from '../support/hierarchy';

const baseline = new URL('../fixtures/v0.1/bridge.mjs', import.meta.url).pathname;
type Report = { evidence_status: string; reason_codes: string[]; snapshot?: { block_hash: string } | null; hierarchy?: unknown[] };
beforeAll(async () => {
  expect(provenance.commit).toBe('4fc4407a3778aad9d0b71db2e1f3e8e58051570a');
  for (const [name, source] of Object.entries(provenance.files)) {
    const bytes = await Bun.file(new URL('../fixtures/v0.1/' + name, import.meta.url)).arrayBuffer();
    expect(bytes.byteLength).toBe(source.bytes);
    expect(createHash('sha256').update(new Uint8Array(bytes)).digest('hex')).toBe(source.sha256);
  }
});

async function compare(raw: string) {
  await settle();
  const input = { command: 'verify', raw, subject: 'github:287365775', rpc_url: testRpc };
  const old = Bun.spawn(['node', baseline], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
  old.stdin.write(JSON.stringify(input)); old.stdin.end();
  const [status, output, error] = await Promise.all([old.exited, new Response(old.stdout).text(), new Response(old.stderr).text()]);
  expect(status, error).toBe(0);
  return [JSON.parse(output) as Report, await execute(input) as Report] as const;
}
async function signed(fixture: Awaited<ReturnType<typeof setupEvm>>, expiresAt?: string) {
  await settle();
  const request = await makeRequest({ name: fixture.name, issuer: issuer.address, subject: 'github:287365775',
    expiresAt: expiresAt ?? ((await publicClient.getBlock()).timestamp + 3600n).toString() }, new ChainReader(testRpc));
  return JSON.stringify({ formatVersion: 1, domain: domain(request.message), endorsement: {
    message: request.message, signature: await issuer.signTypedData(typedData(request.message)) } });
}
async function publish(fixture: Awaited<ReturnType<typeof setupEvm>>) {
  const raw = await signed(fixture);
  await send(fixture.resolver, setTextData(fixture.name, raw));
  return raw;
}
async function rootPermission(resolver: Address, account: Address, grant: boolean) {
  await send(resolver, encodeFunctionData({ abi: resolverArtifact.abi as Abi,
    functionName: grant ? 'grantRootRoles' : 'revokeRootRoles', args: [ROLE_TEXT, account] }));
}

test('direct names preserve valid, helper grant/revoke, and permanent withdrawal behavior', async () => {
  const fixture = await setupEvm(), raw = await publish(fixture);
  const initial = await compare(raw);
  expect(initial.map(report => report.evidence_status)).toEqual(['valid', 'valid']);
  expect(initial[0].snapshot?.block_hash).toBe(initial[1].snapshot?.block_hash);
  expect(initial[0].hierarchy).toBeUndefined(); expect(initial[1].hierarchy).toHaveLength(2);
  const helper = privateKeyToAccount(generatePrivateKey()).address;
  await send(fixture.resolver, encodeFunctionData({ abi: resolverAbi, functionName: 'grantSetterRoles',
    args: [setTextData(fixture.name, ''), helper] }));
  expect((await compare(raw)).map(report => report.evidence_status)).toEqual(['valid', 'valid']);
  await send(fixture.resolver, encodeFunctionData({ abi: resolverAbi, functionName: 'revokeRoles',
    args: [BigInt(keccak256(toHex('devouch.vouch'))), ROLE_TEXT, helper] }));
  expect((await compare(raw)).map(report => report.evidence_status)).toEqual(['valid', 'valid']);
  await send(fixture.resolver, setTextData(fixture.name, ''));
  expect((await compare(raw)).map(report => report.evidence_status)).toEqual(['revoked', 'revoked']);
  await send(fixture.resolver, setTextData(fixture.name, raw));
  expect((await compare(raw)).map(report => report.evidence_status)).toEqual(['revoked', 'revoked']);
}, 120000);

test('restored resolver root authority invalidates old direct endorsements only in the new verifier', async () => {
  const fixture = await setupEvm(), raw = await publish(fixture);
  const helper = privateKeyToAccount(generatePrivateKey()).address;
  await rootPermission(fixture.resolver, helper, true);
  expect((await compare(raw)).map(report => report.evidence_status)).toEqual(['valid', 'invalid']);
  await rootPermission(fixture.resolver, helper, false);
  const restored = await compare(raw);
  expect(restored.map(report => report.evidence_status)).toEqual(['valid', 'invalid']);
  expect(restored[1].reason_codes).toEqual(['publication_mismatch']);
  expect((await compare(await publish(fixture))).map(report => report.evidence_status)).toEqual(['valid', 'valid']);
}, 120000);

test('restored registry label authority already invalidated direct endorsements in v0.1', async () => {
  const fixture = await setupEvm(), raw = await publish(fixture);
  const helper = privateKeyToAccount(generatePrivateKey()).address, resource = nameParts(fixture.name).labelId;
  await registryCall(ETH_REGISTRY, 'grantRoles', [resource, 1n << 24n, helper]);
  await registryCall(ETH_REGISTRY, 'revokeRoles', [resource, 1n << 24n, helper]);
  expect((await compare(raw)).map(report => report.evidence_status)).toEqual(['invalid', 'invalid']);
}, 120000);

test('restored registry root authority invalidates direct endorsements only in the new verifier', async () => {
  const fixture = await setupEvm(), raw = await publish(fixture);
  const helper = privateKeyToAccount(generatePrivateKey()).address;
  await registryCall(ETH_REGISTRY, 'grantRootRoles', [1n << 24n, helper]);
  await registryCall(ETH_REGISTRY, 'revokeRootRoles', [1n << 24n, helper]);
  expect((await compare(raw)).map(report => report.evidence_status)).toEqual(['valid', 'invalid']);
}, 120000);

test('an issuer without root text authority at publication is rejected by the new verifier', async () => {
  const fixture = await setupEvm(), raw = await signed(fixture);
  const helper = privateKeyToAccount(generatePrivateKey());
  await rpc('hardhat_setBalance', [helper.address, toHex(10n ** 18n)]);
  await send(fixture.resolver, encodeFunctionData({ abi: resolverAbi, functionName: 'grantSetterRoles',
    args: [setTextData(fixture.name, ''), helper.address] }));
  await rootPermission(fixture.resolver, issuer.address, false);
  const helperWallet = createWalletClient({ account: helper, chain: sepolia, transport: http(testRpc) });
  const hash = await helperWallet.sendTransaction({ to: fixture.resolver, data: setTextData(fixture.name, raw) });
  await publicClient.waitForTransactionReceipt({ hash });
  const result = await compare(raw);
  expect(result.map(report => report.evidence_status)).toEqual(['valid', 'invalid']);
  expect(result[1].reason_codes).toEqual(['issuer_cannot_publish']);
}, 120000);

test('a new hierarchical endorsement remains unsupported when returning to v0.1', async () => {
  const fixture = await setupHierarchy(), issued = await issueLeaf(fixture.leaves[0]!);
  const result = await compare(issued.raw);
  expect(result.map(report => report.evidence_status)).toEqual(['unavailable', 'valid']);
  expect(result[0].reason_codes).toEqual(['unsupported_namespace']);
}, 120000);

test('expired endorsements retain the expired reason after the direct ENS name also expires', async () => {
  const fixture = await setupEvm(), parts = nameParts(fixture.name);
  const now = (await publicClient.getBlock()).timestamp, nameExpiry = now + 30n;
  await registryCall(ETH_REGISTRY, 'unregister', [parts.labelId]);
  await registryCall(ETH_REGISTRY, 'register', [parts.label, issuer.address, zeroAddress, fixture.resolver,
    BigInt('0x' + '1'.repeat(64)), nameExpiry]);
  const raw = await signed(fixture, (now + 20n).toString());
  await send(fixture.resolver, setTextData(fixture.name, raw));
  expect((await compare(raw)).map(report => report.evidence_status)).toEqual(['valid', 'valid']);
  await rpc('evm_setNextBlockTimestamp', [Number(nameExpiry + 1n)]);
  await rpc('hardhat_mine', ['0x3', '0x0']);
  const result = await compare(raw);
  expect(result.map(report => report.evidence_status)).toEqual(['missing', 'expired']);
  expect(result[0].reason_codes).toEqual(['publication_missing']);
  expect(result[1].reason_codes).toEqual(['expired']);
}, 120000);
