// ABOUTME: Evaluates ordered ENS text updates without resurrecting revoked endorsements.
// ABOUTME: Requires complete history and exact published bytes, independent of repository policy.
import type { Hex } from 'viem';
import { insist } from './errors';

export type Position = { blockNumber: bigint; transactionIndex: number; logIndex: number };
export type Update = Position & { value: string; blockHash: Hex; transactionHash: Hex };
export function order(a: Position, b: Position): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  return a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex;
}
export function evaluateHistory(raw: string, current: string, history: Update[]) {
  const updates = [...history].sort(order);
  insist((updates.at(-1)?.value ?? '') === current, 'history_inconsistent', 'unavailable');
  const first = updates.findIndex(event => event.value === raw);
  if (first < 0) return { status: 'missing' as const, publication: null };
  const publication = updates[first]!;
  const revoked = updates.slice(first + 1).some(event => event.value !== raw);
  return { status: revoked ? 'revoked' as const : 'valid' as const, publication };
}
