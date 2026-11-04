// ABOUTME: Persists a reviewed public ERC-8004 operation before contacting the wallet.
// ABOUTME: Blocks duplicate sends after unknown delivery and clears only rejection or verified completion.
import { type Hex } from 'viem';
import { exactKeys, object } from '../src/json';
import { EvidenceError, insist } from '../src/errors';
import { validHash } from '../src/erc8004';
import { validateTransactionPlan, type TransactionPlan } from '../src/erc8004-operations';
export type Pending = { plan: TransactionPlan; hash: Hex | null };
export function isWalletRejection(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 4001;
}
export function validatePending(value: unknown): Pending {
  const p = object(value); exactKeys(p, ['plan', 'hash']); insist(p.hash === null || validHash(p.hash));
  return { plan: validateTransactionPlan(p.plan), hash: p.hash as Hex | null };
}
export class Submission {
  pending: Pending | null;
  constructor(private persist: (value: Pending | null) => void, pending: Pending | null = null) { this.pending = pending; }
  private save(value: Pending | null) { this.persist(value); this.pending = value; }
  async send(plan: TransactionPlan, send: () => Promise<unknown>) {
    insist(!this.pending, 'pending_transaction');
    this.save({ plan: validateTransactionPlan(plan), hash: null });
    let result: unknown;
    try { result = await send(); }
    catch (error) {
      if (isWalletRejection(error)) { this.save(null); throw new EvidenceError('wallet_rejected'); }
      throw new EvidenceError('submission_unknown', 'unavailable');
    }
    insist(validHash(result), 'submission_unknown', 'unavailable');
    // If saving the returned hash fails, the previously persisted unknown operation still blocks another send.
    this.save({ plan, hash: result });
    return result;
  }
  complete() { this.save(null); }
  import(value: unknown) { insist(!this.pending, 'pending_transaction'); this.save(validatePending(value)); }
}
