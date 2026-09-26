// ABOUTME: Checks saved ENS names without persisting or trusting old verification results.
// ABOUTME: Covers withdrawn-publication recovery and refuses to hide invalid or unavailable current reads.
import { expect, test } from 'bun:test';
import { parseSavedNames, addSavedName, inspectSavedName } from '../../src/endorsement-list';
import { EvidenceError } from '../../src/errors';

const publication = { chainId: 11155111, transactionHash: `0x${'22'.repeat(32)}` as const,
  blockNumber: '11784535', blockHash: `0x${'33'.repeat(32)}` as const };
test('saved lists only contain bounded names and validated publication positions', () => {
  const rows = addSavedName([], 'masusanou.vouches.geeknees.eth', publication);
  expect(parseSavedNames(JSON.stringify({ version: 1, names: rows }))).toEqual(rows);
  expect(() => addSavedName(rows, rows[0]!.name)).toThrow('name_already_saved');
  expect(() => addSavedName([], '<script>.eth')).toThrow();
  expect(() => parseSavedNames('{broken')).toThrow();
  expect(() => parseSavedNames(JSON.stringify({ version: 1, names: [{ name: 'x.eth', evidence_status: 'valid' }] }))).toThrow();
  expect(() => addSavedName(Array.from({ length: 8 }, (_, i) => ({ name: `name${i}.eth` })), 'extra.eth')).toThrow('saved_name_limit');
});
test('current endorsements replace saved publication hints while old missing records recover withdrawal history', async () => {
  const seen: unknown[] = [];
  const verified = { evidence: { evidence_status: 'valid' }, publication };
  const read = async (name: string, hint?: unknown) => { seen.push([name, hint]); return verified; };
  const result = await inspectSavedName({ name: 'issuer.eth', publication }, read);
  expect(result).toEqual({ verified, usedSavedPublication: false });
  expect(seen).toEqual([['issuer.eth', undefined]]);
  const withdrawn = { ...verified, evidence: { evidence_status: 'revoked' } };
  const recovered = await inspectSavedName({ name: 'issuer.eth', publication }, async (_name, hint) => {
    if (!hint) throw new EvidenceError('publication_missing', 'missing');
    return withdrawn;
  });
  expect(recovered).toEqual({ verified: withdrawn, usedSavedPublication: true });
});
test('unavailable and invalid current reads are not silently retried as successful old publications', async () => {
  for (const status of ['unavailable', 'invalid'] as const) {
    let calls = 0;
    await expect(inspectSavedName({ name: 'issuer.eth', publication }, async () => {
      calls++; throw new EvidenceError('test_failure', status);
    })).rejects.toThrow('test_failure');
    expect(calls).toBe(1);
  }
});
