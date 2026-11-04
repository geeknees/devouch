// ABOUTME: Applies repository trust to normalized ERC-8004 evidence independently from ENS policy.
// ABOUTME: Pins registry addresses, implementations, and code hashes instead of treating registries as resolvers.
import { exactKeys, object, strictJson } from './credential';
import { EvidenceError, insist } from './errors';
import { sameAddress, validAddress, validHash, type FeedbackEvidence, type RegistryPin } from './erc8004';
import type { PolicyDecision } from './policy';

export type Erc8004Policy = { format: 'devouch-erc8004-policy-v1'; repositoryId: string; chainId: number;
  trustedIssuers: string[]; allowedScopes: string[]; allowedRegistries: RegistryPin[]; requiredIssuers: 1 };
export const registryKeys = ['identityRegistry', 'reputationRegistry', 'identityImplementation', 'reputationImplementation',
  'identityCodeHash', 'reputationCodeHash', 'identityProxyCodeHash', 'reputationProxyCodeHash'] as const;

export function parseErc8004Policy(raw: string): Erc8004Policy {
  try {
    const p = object(strictJson(raw, 16384));
    exactKeys(p, ['format', 'repositoryId', 'chainId', 'trustedIssuers', 'allowedScopes', 'allowedRegistries', 'requiredIssuers']);
    insist(p.format === 'devouch-erc8004-policy-v1' && p.requiredIssuers === 1);
    insist(typeof p.repositoryId === 'string' && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?![\s\S])/.test(p.repositoryId));
    insist(Number.isSafeInteger(p.chainId) && Number(p.chainId) > 0);
    insist(Array.isArray(p.trustedIssuers) && p.trustedIssuers.length <= 64 && p.trustedIssuers.every(validAddress));
    insist(Array.isArray(p.allowedScopes) && p.allowedScopes.length <= 64 && p.allowedScopes.every(scope =>
      typeof scope === 'string' && /^[a-z][a-z0-9-]{0,63}(?![\s\S])/.test(scope)));
    insist(Array.isArray(p.allowedRegistries) && p.allowedRegistries.length <= 64);
    for (const entry of p.allowedRegistries) {
      const pin = object(entry); exactKeys(pin, [...registryKeys]);
      insist(registryKeys.every(key => key.endsWith('Hash') ? validHash(pin[key]) : validAddress(pin[key])));
    }
    return p as Erc8004Policy;
  } catch { throw new EvidenceError('invalid_policy'); }
}

export function evaluateErc8004Policy(policy: Erc8004Policy, evidence: FeedbackEvidence): PolicyDecision {
  if (evidence.evidence_status !== 'valid') return { policy_status: 'not_evaluated', reason_codes: [...evidence.reason_codes] };
  const reasons: string[] = [];
  if (policy.chainId !== evidence.chainId) reasons.push('chain_not_allowed');
  if (!policy.trustedIssuers.some(issuer => sameAddress(issuer, evidence.issuer ?? ''))) reasons.push('issuer_not_trusted');
  if (!policy.allowedScopes.includes(evidence.scope ?? '')) reasons.push('scope_not_allowed');
  if (!policy.allowedRegistries.some(pin => registryKeys.every(key => sameAddress(pin[key], evidence.registry?.[key] ?? ''))))
    reasons.push('registry_not_allowed');
  return { policy_status: reasons.length ? 'rejected' : 'accepted', reason_codes: reasons };
}
