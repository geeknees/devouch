// ABOUTME: Binds ERC-8004 evidence to the actual PR author and the immutable base policy.
// ABOUTME: Reads only bounded public JSON at fixed commits and never checks out or executes PR code.
import { Erc8004Reader, parseFeedbackReference, type FeedbackEvidence, type FeedbackReference } from './erc8004';
import { evaluateErc8004Policy, parseErc8004Policy } from './erc8004-policy';
import { EvidenceError, insist } from './errors';
import { GitHubError, GitHubReader } from './github';

export async function verifyPullRequest(url: string, reader: Pick<Erc8004Reader, 'inspect'>,
  github = new GitHubReader(), signal?: AbortSignal) {
  const pullRequest = await github.pullRequest(url, signal);
  const policyRaw = await github.file(pullRequest.repository, '.devouch/erc8004-policy.json', pullRequest.baseSha, 16_384, signal);
  if (policyRaw === null) throw new GitHubError('policy_missing');
  let policy;
  try { policy = parseErc8004Policy(policyRaw); }
  catch (error) { throw new GitHubError(error instanceof EvidenceError ? error.code : 'invalid_policy'); }
  if (policy.repositoryId !== pullRequest.repository) throw new GitHubError('policy_repository_mismatch');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(policyRaw));
  const policyDigest = 'sha256:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const subject = 'github:' + pullRequest.authorId, credentialPath = `.devouch/feedback/github-${pullRequest.authorId}.json`;
  const raw = await github.file(pullRequest.headRepository, credentialPath, pullRequest.headSha, 4096, signal);
  let reference: FeedbackReference | null = null, evidence: FeedbackEvidence;
  try {
    insist(raw !== null, 'credential_missing', 'missing');
    reference = parseFeedbackReference(raw);
    signal?.throwIfAborted();
    evidence = await reader.inspect(reference, subject);
    if (evidence.evidence_status === 'valid') insist(evidence.subject === subject, 'subject_mismatch');
  } catch (error) {
    const failure = error instanceof EvidenceError ? error : new EvidenceError('verification_unavailable', 'unavailable');
    evidence = { evidence_status: failure.status, reason_codes: [failure.code] };
  }
  return { pullRequest, subject, credentialPath, policy, policyRaw, policyDigest, reference,
    evidence, decision: evaluateErc8004Policy(policy, evidence) };
}
