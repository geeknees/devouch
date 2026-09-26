// ABOUTME: Verifies issuer name display for configured, absent, and unavailable reverse records.
// ABOUTME: Keeps optional naming failures separate from endorsement evidence and repository acceptance.
import { expect, test } from 'bun:test';
import { lookupIssuerName } from '../../src/identity';

const address = '0x894108DC5640e36c478523228addA22b58Eeb79c';
test('reverse lookup uses the issuer address and the checked block', async () => {
  const calls: unknown[] = [];
  const identity = await lookupIssuerName({ async getEnsName(input) { calls.push(input); return 'masusanou-dev.eth'; } }, address, 11780510n);
  expect(calls).toEqual([{ address, blockNumber: 11780510n }]);
  expect(identity).toEqual({ name: 'masusanou-dev.eth', status: 'resolved' });
});
test('an unset primary name falls back to the address', async () => {
  expect(await lookupIssuerName({ async getEnsName() { return null; } }, address, 1n))
    .toEqual({ name: null, status: 'not_set' });
});
test('reverse lookup failure falls back without exposing provider diagnostics', async () => {
  expect(await lookupIssuerName({ async getEnsName() { throw new Error('private provider diagnostics'); } }, address, 1n))
    .toEqual({ name: null, status: 'unavailable' });
});
