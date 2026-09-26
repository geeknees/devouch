// ABOUTME: Exercises issue, reuse, revoke, and resurrection against real ENSv2 bytecode.
// ABOUTME: This local EVM evidence is separate from public Sepolia and real GitHub PR checks.
import { expect, test } from 'bun:test';
import { ChainReader } from '../../src/chain';
import { domain, parseCredential, typedData, validateMessage } from '../../src/credential';
import { setTextData } from '../../src/ens';
import { setupEvm, settle, publicClient, issuer, wallet, testRpc } from '../support/evm';

test('official resolver publishes, archives and permanently revokes one portable endorsement', async () => {
  const { resolver, name, origin } = await setupEvm();
  const reader = new ChainReader(testRpc);
  await settle();
  const location = await reader.prepare(name, issuer.address);
  expect(location.anchor_start_block).toBe(origin.toString());
  const block = await publicClient.getBlock();
  const message = validateMessage({ version: '1', id: `0x${'11'.repeat(32)}`, requestNonce: `0x${'22'.repeat(32)}`,
    issuer: issuer.address, subject: 'github:12345', scope: 'oss-contribution',
    issuedAt: block.timestamp.toString(), expiresAt: (block.timestamp + 3600n).toString(),
    recordName: name, resolver, recordId: location.record_id, anchorStartBlock: location.anchor_start_block });
  const raw = JSON.stringify({ formatVersion: 1, domain: domain(message), endorsement: {
    message, signature: await issuer.signTypedData(typedData(message)) } });
  const hash = await wallet.sendTransaction({ to: resolver, data: setTextData(name, raw) });
  const published = await publicClient.waitForTransactionReceipt({ hash });
  expect((await publicClient.getBlock({ blockNumber: published.blockNumber })).timestamp).toBeGreaterThanOrEqual(BigInt(message.issuedAt));
  await settle();
  const valid = await reader.inspect(await parseCredential(raw));
  expect(valid.evidence_status).toBe('valid');
  const fetched = await reader.fetch(name);
  expect(fetched.raw).toBe(raw);
  expect(Object.keys(fetched).sort()).toEqual(['publication', 'raw', 'snapshot', 'subject']);
  const verified = await reader.verifyName(name);
  expect(verified.parsed.raw).toBe(raw);
  expect(verified.evidence.evidence_status).toBe('valid');
  expect(verified.snapshot).toEqual(verified.evidence.snapshot);
  const revoke = await wallet.sendTransaction({ to: resolver, data: setTextData(name, '') });
  await publicClient.waitForTransactionReceipt({ hash: revoke });
  await settle();
  expect((await reader.inspect(await parseCredential(raw))).evidence_status).toBe('revoked');
  expect((await reader.fetch(name, valid.publication!)).raw).toBe(raw);
  expect((await reader.verifyName(name, valid.publication!)).evidence.evidence_status).toBe('revoked');
  const restore = await wallet.sendTransaction({ to: resolver, data: setTextData(name, raw) });
  await publicClient.waitForTransactionReceipt({ hash: restore });
  await settle();
  expect((await reader.inspect(await parseCredential(raw))).evidence_status).toBe('revoked');
}, 120000);
