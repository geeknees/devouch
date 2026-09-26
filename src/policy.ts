// ABOUTME: Applies the same explicit repository policy contract as the Ruby CLI.
// ABOUTME: Evaluates only valid evidence and preserves the CLI reason order for shared fixture tests.
import { exactKeys, object, strictJson } from './credential';
import { EvidenceError, insist, type EvidenceStatus } from './errors';

export type RepositoryPolicy = { repositoryId: string; chainId: number; trustedIssuers: string[];
  allowedScopes: string[]; allowedResolvers: { address: string; implementation: string }[]; requiredIssuers: number };
export type PolicyEvidence = { evidence_status: EvidenceStatus; reason_codes: string[];
  issuer?: string | null; scope?: string | null; resolver?: string | null; implementation?: string | null };
export type PolicyDecision = { policy_status: 'accepted' | 'rejected' | 'not_evaluated'; reason_codes: string[] };
const isAddress = (value: unknown): value is string => typeof value === 'string'
  && /^0x[0-9a-fA-F]{40}(?![\s\S])/.test(value) && !/^0x0{40}$/.test(value);
const list = (value: unknown, predicate: (item: unknown) => boolean) =>
  Array.isArray(value) && value.length <= 64 && value.every(predicate);
const sameAddress = (left: string, right: string | null | undefined) => left.toLowerCase() === (right ?? '').toLowerCase();

export function parsePolicy(raw: string): RepositoryPolicy {
  try {
    const p = object(strictJson(raw, 16384));
    exactKeys(p, ['repositoryId', 'chainId', 'trustedIssuers', 'allowedScopes', 'allowedResolvers', 'requiredIssuers']);
    insist(typeof p.repositoryId === 'string' && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?![\s\S])/.test(p.repositoryId));
    insist(p.chainId === 11155111 && p.requiredIssuers === 1);
    insist(list(p.trustedIssuers, isAddress));
    insist(list(p.allowedScopes, value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}(?![\s\S])/.test(value)));
    insist(list(p.allowedResolvers, value => {
      const entry = object(value); exactKeys(entry, ['address', 'implementation']);
      return isAddress(entry.address) && isAddress(entry.implementation);
    }));
    return p as RepositoryPolicy;
  } catch { throw new EvidenceError('invalid_policy'); }
}

export function evaluatePolicy(policy: RepositoryPolicy, evidence: PolicyEvidence): PolicyDecision {
  if (evidence.evidence_status !== 'valid') return { policy_status: 'not_evaluated', reason_codes: [...evidence.reason_codes] };
  const reasons: string[] = [];
  if (!policy.trustedIssuers.some(issuer => sameAddress(issuer, evidence.issuer))) reasons.push('issuer_not_trusted');
  if (!policy.allowedScopes.includes(evidence.scope ?? '')) reasons.push('scope_not_allowed');
  if (!policy.allowedResolvers.some(entry => sameAddress(entry.address, evidence.resolver)
    && sameAddress(entry.implementation, evidence.implementation))) reasons.push('resolver_not_allowed');
  return { policy_status: reasons.length ? 'rejected' : 'accepted', reason_codes: reasons };
}
