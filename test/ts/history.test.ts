// ABOUTME: Defines irreversible revocation and publication-location semantics.
// ABOUTME: Covers reordered logs, replacement, and reused identifiers.
import { expect, test } from 'bun:test';
import { evaluateHistory, type Update } from '../../src/history';

const raw = '{"synthetic":"credential"}';
const event = (value: string, block: bigint, index = 0): Update => ({ value,
  blockNumber: block, transactionIndex: 0, logIndex: index,
  blockHash: `0x${'aa'.repeat(32)}`, transactionHash: `0x${'bb'.repeat(32)}` });

test('publication is required even when a copy exists', () => {
  expect(evaluateHistory(raw, '', []).status).toBe('missing');
});
test('publication survives duplicate writes of the exact bytes', () => {
  expect(evaluateHistory(raw, raw, [event(raw, 1n), event(raw, 2n)]).status).toBe('valid');
});
test('clearing, replacing, and restoring never resurrect an old credential', () => {
  for (const replacement of ['', '{"other":true}']) {
    const result = evaluateHistory(raw, raw, [event(raw, 3n), event(replacement, 2n), event(raw, 1n)]);
    expect(result.status).toBe('revoked');
    expect(result.publication?.blockNumber).toBe(1n);
  }
});
test('transaction and log ordering detects same-block revoke/restore', () => {
  expect(evaluateHistory(raw, raw, [event(raw, 1n, 0), event('', 1n, 1), event(raw, 1n, 2)]).status).toBe('revoked');
});
test('inconsistent current state and log history cannot be accepted', () => {
  expect(() => evaluateHistory(raw, raw, [event(raw, 1n), event('', 2n)])).toThrow();
});
