// ABOUTME: Exercises portable signatures and rejects ambiguous or altered credentials.
// ABOUTME: Uses disposable synthetic accounts and identifiers without network access.
import { describe, expect, test } from 'bun:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseCredential, typedData, validateMessage } from '../../src/credential';

export const account = privateKeyToAccount(generatePrivateKey());
export const message = {
  version: '1', id: `0x${'11'.repeat(32)}`, issuer: account.address,
  subject: 'github:12345', scope: 'oss-contribution', issuedAt: '1790340000',
  expiresAt: '1790944800', requestNonce: `0x${'22'.repeat(32)}`,
  recordName: 'demo.eth', resolver: `0x${'33'.repeat(20)}`, recordId: '1', anchorStartBlock: '11709000',
};

export async function signed(changes: Record<string, unknown> = {}) {
  const m = validateMessage({ ...message, ...changes });
  const data = typedData(m);
  return JSON.stringify({ formatVersion: 1, domain: data.domain,
    endorsement: { message: m, signature: await account.signTypedData(data) } });
}

describe('credential', () => {
  test('the same signature verifies independently of the receiving repository', async () => {
    const parsed = await parseCredential(await signed());
    expect(parsed.message.subject).toBe('github:12345');
    expect(parsed.message).not.toHaveProperty('repositoryId');
  });
  test.each(['subject', 'scope', 'expiresAt', 'recordId', 'anchorStartBlock'])('rejects altered %s', async field => {
    const value = JSON.parse(await signed());
    value.endorsement.message[field] = field === 'subject' ? 'github:67890' : field === 'scope' ? 'other' : '1790999999';
    await expect(parseCredential(JSON.stringify(value))).rejects.toMatchObject({ code: 'invalid_signature' });
  });
  test('rejects a different signer, chain, and contract domain', async () => {
    for (const field of ['signature', 'chain', 'contract']) {
      const value = JSON.parse(await signed());
      if (field === 'signature') value.endorsement.signature = await privateKeyToAccount(generatePrivateKey()).signTypedData(typedData(validateMessage(message)));
      if (field === 'chain') value.domain.chainId = 1;
      if (field === 'contract') value.domain.verifyingContract = `0x${'44'.repeat(20)}`;
      await expect(parseCredential(JSON.stringify(value))).rejects.toBeDefined();
    }
  });
  test.each(['{', '{"formatVersion":1,"formatVersion":1}', ' '.repeat(4097)])('rejects malformed, duplicate or oversized JSON', async raw => {
    await expect(parseCredential(raw)).rejects.toMatchObject({ code: 'invalid_format' });
  });
  test('refuses rounded numbers, noncanonical names, extra claims, and unsafe subjects', async () => {
    for (const changes of [{ issuedAt: 1790340000 }, { recordName: 'Demo.eth' }, { subject: 'github:01' }, { subject: 'github:1\n' }, { worldVerified: true }, { expiresAt: '1790339999' }]) {
      expect(() => validateMessage({ ...message, ...changes })).toThrow();
    }
  });
});
