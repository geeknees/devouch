// ABOUTME: Exercises authority limits, restored bindings, upgrades, expiry, and history anchors.
// ABOUTME: Uses real official ENSv2 code so event and permission assumptions cannot be mocked away.
import { expect, test } from 'bun:test';
import { createWalletClient, encodeFunctionData, http, keccak256, toHex, zeroAddress, type EIP1193Provider } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { ChainReader } from '../../src/chain';
import { domain, parseCredential, typedData, type Message } from '../../src/credential';
import { makeRequest, makeRevoke } from '../../src/operations';
import { ETH_REGISTRY, RESOLVER_IMPL, ROLE_TEXT, nameParts, registryAbi, resolverAbi, setTextData } from '../../src/ens';
import { Submission } from '../../web/submission';
import { WalletSession } from '../../web/wallet';
import { setupEvm, settle, publicClient, issuer, wallet, testRpc, rpc } from '../support/evm';

async function send(to: `0x${string}`, data: `0x${string}`) {
  const hash = await wallet.sendTransaction({ to, data });
  await publicClient.waitForTransactionReceipt({ hash }); await settle();
  return hash;
}
async function issue(fixture: Awaited<ReturnType<typeof setupEvm>>, override: Partial<Message> = {}) {
  await settle();
  const request = await makeRequest({ name: fixture.name, issuer: issuer.address, subject: 'github:287365775',
    expiresAt: ((await publicClient.getBlock()).timestamp + 3600n).toString() }, new ChainReader(testRpc));
  Object.assign(request.message, override);
  const raw = JSON.stringify({ formatVersion: 1, domain: domain(request.message), endorsement: {
    message: request.message, signature: await issuer.signTypedData(typedData(request.message)) } });
  await send(fixture.resolver, setTextData(fixture.name, raw));
  return { raw, request, parsed: await parseCredential(raw) };
}
const provider = { async request({ method, params }: { method: string; params?: unknown[] }) {
  if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [issuer.address];
  if (method === 'eth_sendTransaction') {
    const input = params![0] as { to: `0x${string}`; data: `0x${string}` };
    return send(input.to, input.data);
  }
  return rpc(method, params);
} } as EIP1193Provider;

test('the issuer creates and binds a dedicated official resolver through the wallet workflow', async () => {
  const fixture = await setupEvm();
  await settle();
  const session = new WalletSession(testRpc, provider, new Submission(() => {}));
  await session.connect();
  const deployed = await session.deploy(fixture.name);
  expect(deployed.resolver).toBeDefined();
  await session.bind(fixture.name, deployed.resolver!);
  const prepared = await new ChainReader(testRpc).prepare(fixture.name, issuer.address);
  expect(prepared.resolver).toBe(deployed.resolver!);
  expect(prepared.current_value).toBe('');
  const signed = await issue({ ...fixture, resolver: deployed.resolver! });
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('valid');
}, 120000);

test('a recent deployment needs only its own history when the provider prunes unrelated old state', async () => {
  const fixture = await setupEvm();
  await settle();
  const minimum = (await publicClient.getBlock()).number - 32n;
  let denied = 0;
  const limited = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    const input = await request.json() as { id: number; method: string; params: unknown[] };
    if (input.method === 'eth_getCode' && /^0x/.test(String(input.params[1])) && BigInt(input.params[1] as string) < minimum) {
      denied++;
      return Response.json({ jsonrpc: '2.0', id: input.id, error: { code: -32000, message: 'Historical state unavailable' } });
    }
    const upstream = await fetch(testRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    return new Response(await upstream.text(), { headers: { 'content-type': 'application/json' } });
  } });
  try {
    const location = await new ChainReader(limited.url.toString()).prepare(fixture.name, issuer.address);
    expect(location.anchor_start_block).toBe(fixture.origin.toString());
    expect(denied).toBe(0);
  } finally { await limited.stop(true); }
}, 120000);

test('a helper can change only the endorsement key; removing its grant leaves issuer withdrawal available', async () => {
  const fixture = await setupEvm();
  const signed = await issue(fixture);
  const helper = privateKeyToAccount(generatePrivateKey());
  await rpc('hardhat_setBalance', [helper.address, toHex(10n ** 18n)]);
  const session = new WalletSession(testRpc, provider, new Submission(() => {}));
  await session.connect();
  await session.helper(fixture.name, helper.address, true);
  const allowed = async (key: string) => publicClient.readContract({ address: fixture.resolver, abi: resolverAbi,
    functionName: 'hasRoles', args: [BigInt(keccak256(toHex(key))), ROLE_TEXT, helper.address] });
  expect(await allowed('devouch.vouch')).toBe(true);
  expect(await allowed('url')).toBe(false);
  const helperWallet = createWalletClient({ account: helper, chain: sepolia, transport: http(testRpc) });
  const canCall = (data: `0x${string}`) => publicClient.call({ account: helper.address, to: fixture.resolver, data }).then(() => true, () => false);
  expect(await canCall(setTextData(fixture.name, 'https://example.org', 'url'))).toBe(false);
  expect(await canCall(encodeFunctionData({ abi: resolverAbi, functionName: 'linkToRecord', args: [nameParts(fixture.name).dns, 0n] }))).toBe(false);
  const hash = await helperWallet.sendTransaction({ to: fixture.resolver, data: setTextData(fixture.name, '') });
  await publicClient.waitForTransactionReceipt({ hash }); await settle();
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('revoked');
  const replacement = await issue(fixture);
  await session.helper(fixture.name, helper.address, false);
  expect(await allowed('devouch.vouch')).toBe(false);
  expect(await canCall(setTextData(fixture.name, ''))).toBe(false);
  await session.revoke(await makeRevoke(replacement.raw, new ChainReader(testRpc)));
  expect((await new ChainReader(testRpc).inspect(replacement.parsed)).evidence_status).toBe('revoked');
}, 120000);

test('restoring a temporary record link or resolver binding never revives the old endorsement', async () => {
  const fixture = await setupEvm();
  const signed = await issue(fixture);
  await send(fixture.resolver, setTextData('other-record.eth', ''));
  const other = await publicClient.readContract({ address: fixture.resolver, abi: resolverAbi,
    functionName: 'getRecordId', args: [nameParts('other-record.eth').node] });
  for (const record of [other, BigInt(signed.parsed.message.recordId)]) await send(fixture.resolver,
    encodeFunctionData({ abi: resolverAbi, functionName: 'linkToRecord', args: [nameParts(fixture.name).dns, record] }));
  expect((await new ChainReader(testRpc).inspect(signed.parsed)).evidence_status).toBe('invalid');
  const next = await issue(fixture);
  const publication = (await new ChainReader(testRpc).inspect(next.parsed)).publication!;
  await send(ETH_REGISTRY, encodeFunctionData({ abi: registryAbi, functionName: 'setResolver', args: [nameParts(fixture.name).labelId, zeroAddress] }));
  expect((await new ChainReader(testRpc).fetch(fixture.name, publication)).raw).toBe(next.raw);
  for (const resolver of [fixture.resolver]) await send(ETH_REGISTRY,
    encodeFunctionData({ abi: registryAbi, functionName: 'setResolver', args: [nameParts(fixture.name).labelId, resolver] }));
  expect((await new ChainReader(testRpc).inspect(next.parsed)).evidence_status).toBe('invalid');
}, 120000);

test('an upgrade to the same implementation remains unsupported history', async () => {
  const fixture = await setupEvm();
  const signed = await issue(fixture);
  await send(fixture.resolver, encodeFunctionData({ abi: resolverAbi, functionName: 'upgradeToAndCall', args: [RESOLVER_IMPL, '0x'] }));
  await expect(new ChainReader(testRpc).inspect(signed.parsed)).rejects.toThrow('resolver_upgraded');
  await expect(new ChainReader(testRpc).prepare(fixture.name, issuer.address)).rejects.toThrow('resolver_upgraded');
}, 120000);

test('expiry, identifier reuse, stale write requests, and a truncated anchor cannot produce acceptance', async () => {
  const fixture = await setupEvm();
  const now = (await publicClient.getBlock()).timestamp;
  const expired = await issue(fixture, { issuedAt: (now - 60n).toString(), expiresAt: (now - 30n).toString() });
  expect((await new ChainReader(testRpc).inspect(expired.parsed)).evidence_status).toBe('expired');
  const reused = await issue(fixture, { id: expired.parsed.message.id });
  expect((await new ChainReader(testRpc).inspect(reused.parsed)).evidence_status).toBe('invalid');
  await expect(new ChainReader(testRpc).assertWritable(expired.request.message, expired.raw, issuer.address, true)).rejects.toThrow('publication_changed');
  const truncated = await issue(fixture, { anchorStartBlock: (fixture.origin + 1n).toString() });
  await expect(new ChainReader(testRpc).inspect(truncated.parsed)).rejects.toThrow('invalid_anchor');
  await expect(new ChainReader('http://127.0.0.1:1').inspect(truncated.parsed)).rejects.toThrow('rpc_unavailable');
}, 120000);
