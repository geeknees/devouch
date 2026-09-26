// ABOUTME: Binds a public PR author's endorsement to its base policy and fixed head commit.
// ABOUTME: Reuses the signature, ENS history, snapshot, and shared repository-policy verifiers.
import type { ChainEvidence, ChainReader, Snapshot } from './chain';
import { parseCredential, type ParsedCredential } from './credential';
import { EvidenceError, insist } from './errors';
import { GitHubError, GitHubReader } from './github';
import { evaluatePolicy, parsePolicy, type PolicyEvidence } from './policy';

export async function verifyPullRequest(url: string, reader: Pick<ChainReader, 'inspect'>,
  github = new GitHubReader(), signal?: AbortSignal) {
  const pullRequest = await github.pullRequest(url, signal);
  const policyRaw = await github.file(pullRequest.repository, '.devouch/policy.json', pullRequest.baseSha, 16_384, signal);
  if (policyRaw === null) throw new GitHubError('policy_missing');
  let policy;
  try { policy = parsePolicy(policyRaw); } catch { throw new GitHubError('invalid_policy'); }
  if (policy.repositoryId !== pullRequest.repository) throw new GitHubError('policy_repository_mismatch');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(policyRaw));
  const policyDigest = 'sha256:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const subject = 'github:' + pullRequest.authorId, credentialPath = `.devouch/vouches/github-${pullRequest.authorId}.json`;
  const raw = await github.file(pullRequest.headRepository, credentialPath, pullRequest.headSha, 4096, signal);
  let parsed: ParsedCredential | null = null;
  let signatureStatus: 'valid' | 'invalid' | 'not_verified' = 'not_verified';
  let evidence: PolicyEvidence & { snapshot: Snapshot | null; hierarchy?: ChainEvidence['hierarchy'] };
  try {
    insist(raw !== null, 'credential_missing', 'missing');
    parsed = await parseCredential(raw);
    signatureStatus = 'valid';
    insist(parsed.message.subject === subject, 'subject_mismatch');
    signal?.throwIfAborted();
    const proof = await reader.inspect(parsed), m = parsed.message;
    evidence = { ...proof, issuer: m.issuer, scope: m.scope, resolver: m.resolver };
  } catch (error) {
    const failure = error instanceof EvidenceError ? error : new EvidenceError('verification_unavailable', 'unavailable');
    if (failure.code === 'invalid_signature') signatureStatus = 'invalid';
    evidence = { evidence_status: failure.status, reason_codes: [failure.code], snapshot: null };
  }
  return { pullRequest, subject, credentialPath, policy, policyRaw, policyDigest, parsed, signatureStatus,
    evidence, decision: evaluatePolicy(policy, evidence) };
}
