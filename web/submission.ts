// ABOUTME: Persists public transaction intent before asking the wallet to submit.
// ABOUTME: Blocks automatic resubmission when delivery is unknown and supports receipt recovery.
import type { Address, Hex } from 'viem';
import { EvidenceError, insist } from '../src/errors';
import { address, object, uint } from '../src/credential';
import { nameParts } from '../src/ens';

export type Pending = { kind: 'publish' | 'revoke' | 'deploy' | 'bind' | 'grant' | 'remove';
  name: string; to: Address; data: Hex; hash?: Hex; raw?: string; recordId?: string;
  value?: string; helper?: Address; account?: Address };

export function validatePending(input: unknown): Pending {
  const value = object(input);
  insist(['publish', 'revoke', 'deploy', 'bind', 'grant', 'remove'].includes(value.kind as string), 'invalid_recovery');
  insist(Object.keys(value).every(key => ['kind', 'name', 'to', 'data', 'hash', 'raw', 'recordId', 'value', 'helper', 'account'].includes(key)), 'invalid_recovery');
  address(value.to); address(value.account);
  insist(typeof value.name === 'string'); nameParts(value.name);
  insist(typeof value.data === 'string' && /^0x(?:[0-9a-fA-F]{2})+$/.test(value.data) && value.data.length <= 20000, 'invalid_recovery');
  if (value.hash !== undefined) insist(typeof value.hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value.hash), 'invalid_recovery');
  if (value.kind === 'publish' || value.kind === 'revoke') {
    uint(value.recordId);
    insist(typeof value.raw === 'string' && new TextEncoder().encode(value.raw).length <= 4096, 'invalid_recovery');
    insist(value.value === (value.kind === 'publish' ? value.raw : ''), 'invalid_recovery');
  }
  if (value.kind === 'bind') address(value.value);
  if (value.kind === 'grant' || value.kind === 'remove') address(value.helper);
  return value as Pending;
}

export class Submission {
  pending: Pending | null;
  constructor(private save: (value: Pending | null) => void, initial: Pending | null = null) {
    this.pending = initial;
  }
  async submit(draft: Pending, send: () => Promise<Hex>) {
    insist(!this.pending, 'pending_transaction');
    this.pending = draft;
    this.save(draft);
    try {
      const hash = await send();
      this.pending = { ...draft, hash };
      this.save(this.pending);
      return hash;
    } catch (error) {
      let current: unknown = error;
      for (let depth = 0; depth < 6 && current && typeof current === 'object'; depth++) {
        if ('code' in current && current.code === 4001) {
          this.complete();
          throw new EvidenceError('wallet_rejected');
        }
        current = 'cause' in current ? current.cause : undefined;
      }
      throw new EvidenceError('submission_unknown', 'unavailable');
    }
  }
  complete() { this.pending = null; this.save(null); }
}
