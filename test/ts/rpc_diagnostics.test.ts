// ABOUTME: Checks bounded, sanitized RPC diagnostics and their separation from endorsement acceptance.
// ABOUTME: Covers provider limits, history failures, wrong chains, and partial diagnostic completion.
import { expect, test } from 'bun:test';
import { classifyRpcFailure, RpcUnavailableError } from '../../src/rpc-errors';
import { diagnoseConnection } from '../../src/rpc-diagnostics';
import { EvidenceError } from '../../src/errors';

test('provider failure classification inspects causes without returning private diagnostics', () => {
  for (const error of [{ status: 429 }, { cause: { code: -32005, message: 'rate limit exceeded' } }, { cause: { message: 'Rate limit exceeded https://secret.test/key' } }]) {
    expect(classifyRpcFailure(error)).toBe('rate_limited');
    const safe = new RpcUnavailableError(error);
    expect(safe.code).toBe('rpc_unavailable');
    expect(safe.status).toBe('unavailable');
    expect(JSON.stringify(safe)).not.toContain('secret');
  }
  expect(classifyRpcFailure({ cause: { message: 'missing trie node 0x123' } })).toBe('history_unavailable');
  expect(classifyRpcFailure({ message: 'historical state is not available' })).toBe('history_unavailable');
  expect(classifyRpcFailure({ code: -32005, message: 'block range too wide' })).toBe('provider_limit');
  expect(classifyRpcFailure({ code: -32005 })).toBe('provider_limit');
  expect(classifyRpcFailure({ name: 'TimeoutError' })).toBe('timeout');
  expect(classifyRpcFailure(new Error('Failed to fetch'))).toBe('connection_failed');
  const cycle: { cause?: unknown } = {}; cycle.cause = cycle;
  expect(classifyRpcFailure(cycle)).toBe('connection_failed');
});

const snapshot = { chain_id: 11155111, block_number: '12345678', block_hash: `0x${'11'.repeat(32)}` as const,
  block_timestamp: '1790400000', checked_at: '2026-09-26T08:00:00Z', confirmations: 2 };
const probe = () => ({ snapshot: async () => snapshot, historicalState: async () => {}, historicalLogs: async () => {} });
test('successful connection diagnostics are scoped probes, with no acceptance claim', async () => {
  const result = await diagnoseConnection(probe());
  expect(result.checks.map(check => check.status)).toEqual(['passed', 'passed', 'passed']);
  expect(result.snapshot).toEqual(snapshot);
  expect(result).not.toHaveProperty('evidence_status');
  expect(result).not.toHaveProperty('policy_status');
});
test('a failed snapshot skips history probes and preserves wrong-chain and stale-state reasons', async () => {
  for (const code of ['chain_mismatch', 'stale_snapshot']) {
    let called = false;
    const result = await diagnoseConnection({ ...probe(), snapshot: async () => { throw new EvidenceError(code); },
      historicalState: async () => { called = true; } });
    expect(result.checks.map(check => check.status)).toEqual(['failed', 'not_checked', 'not_checked']);
    expect(result.checks[0]!.reason).toBe(code);
    expect(called).toBe(false);
  }
});
test('archive failure remains distinct from log availability and rate limits halt further requests', async () => {
  const result = await diagnoseConnection({ ...probe(), historicalState: async () => { throw { message: 'missing trie node' }; } });
  expect(result.checks[1]).toMatchObject({ status: 'failed', reason: 'history_unavailable' });
  expect(result.checks[2]!.status).toBe('passed');
  let logs = false;
  const limited = await diagnoseConnection({ ...probe(), historicalState: async () => { throw { status: 429 }; },
    historicalLogs: async () => { logs = true; } });
  expect(limited.checks[1]!.reason).toBe('rate_limited');
  expect(limited.checks[2]!.status).toBe('not_checked');
  expect(logs).toBe(false);
});
