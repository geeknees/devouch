// ABOUTME: Displays a public PR author's endorsement and the receiving repository's committed policy.
// ABOUTME: Separates GitHub read failures, evidence validity, and acceptance without wallet access.
import { ChainReader } from '../src/chain';
import { GitHubError, parsePullRequestUrl } from '../src/github';
import { lookupIssuerName } from '../src/identity';
import { verifyPullRequest } from '../src/pull-request';
import { initializeTrustMap } from './trust-map';

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById('verify-pr-' + id) as T;
const text = (id: string, value: string) => { element(id).textContent = value; };
const verdict = (id: string, value: string) => { text(id, value); element(id).dataset.state = value; };
const link = (id: string, href: string) => { element<HTMLAnchorElement>(id).href = href; };

export function pullRequestVerificationUrl(base: string, input: string) {
  const url = new URL(base);
  url.search = ''; url.hash = 'verify';
  url.searchParams.set('pr', parsePullRequestUrl(input).url);
  return url.href;
}

export function initializePullRequestVerification(getRpc: () => string) {
  const map = initializeTrustMap(element('trust-map'));
  let revision = 0, checking = false, controller: AbortController | undefined;
  const controls = element<HTMLFieldSetElement>('inputs'), input = element<HTMLInputElement>('url');
  function clear() {
    revision++; controller?.abort(); map.clear();
    element('result').hidden = true; element('share').hidden = true; element('record').hidden = true;
    element('vouched-by').hidden = true; text('name-status', '');
  }
  function invalidate() {
    clear(); text('status', 'Checks the PR’s current commits and a fresh Sepolia snapshot. Public GitHub repositories only.');
  }
  async function verify() {
    if (checking) return;
    clear();
    const ownRevision = revision;
    controller = new AbortController(); checking = true; controls.disabled = true;
    element('result').setAttribute('aria-busy', 'true');
    text('status', 'Reading the PR author, the base policy, and the head endorsement; checking its signature and ENS history…');
    try {
      const reader = new ChainReader(getRpc());
      const report = await verifyPullRequest(input.value, reader, undefined, controller.signal);
      if (ownRevision !== revision) return;
      const pr = report.pullRequest, proof = report.evidence, message = report.parsed?.message;
      input.value = pr.url;
      text('title', `${pr.repository} #${pr.number}`); link('source', pr.url);
      text('author', `@${pr.authorLogin} · ${report.subject}`);
      text('base-sha', pr.baseSha); text('head-sha', pr.headSha);
      text('repository', pr.repository); text('policy-json', JSON.stringify(report.policy, null, 2));
      text('policy-digest', report.policyDigest);
      link('policy-source', `https://github.com/${pr.repository}/blob/${pr.baseSha}/.devouch/policy.json`);
      link('credential-source', `https://github.com/${pr.headRepository}/blob/${pr.headSha}/${report.credentialPath}`);
      verdict('evidence-status', proof.evidence_status); text('signature-status', report.signatureStatus);
      text('evidence-reasons', proof.reason_codes.join(', ') || 'Signature, PR author, publication history, and snapshot checks passed.');
      verdict('policy-status', report.decision.policy_status);
      text('policy-reasons', report.decision.reason_codes.join(', ') || 'The issuer, scope, and resolver match the receiving repository’s policy.');
      text('block', proof.snapshot?.block_number ?? 'not checked');
      text('block-hash', proof.snapshot?.block_hash ?? 'not checked');
      text('checked-at', proof.snapshot?.checked_at ?? 'not checked');
      text('hierarchy', proof.hierarchy?.map(hop => `${hop.name} — registry ${hop.registry}; owner ${hop.owner}`).join('\n') ?? 'not checked');
      if (message) {
        text('vouched-by', 'Vouched by ' + message.issuer); element('vouched-by').hidden = false;
        text('issuer', message.issuer); text('record-name', message.recordName); text('subject', message.subject);
        verdict('subject-match', message.subject === report.subject ? 'matches PR author' : 'does not match PR author');
        element('subject-match').dataset.state = message.subject === report.subject ? 'valid' : 'invalid';
        const expiry = new Date(Number(message.expiresAt) * 1000);
        text('scope', message.scope); text('expiry', Number.isFinite(expiry.getTime()) ? expiry.toISOString() : message.expiresAt + ' (Unix seconds)');
        element('record').hidden = false;
      }
      const shared = pullRequestVerificationUrl(location.href, pr.url);
      element<HTMLInputElement>('share-url').value = shared; link('share-link', shared); text('copy-status', '');
      element('result').hidden = false; element('share').hidden = false;
      const mapReport = message ? { message, evidence: proof, author: { subject: report.subject, login: pr.authorLogin },
        policies: [{ id: 'policy-repo', title: pr.repository, policy: report.policy, decision: report.decision,
          source: { url: element<HTMLAnchorElement>('policy-source').href, baseSha: pr.baseSha, digest: report.policyDigest } }] } : null;
      if (mapReport) map.update(mapReport);
      try { history.replaceState(null, '', shared); } catch { /* The visible share link remains available. */ }
      text('status', 'Checked the commits below. Verify again to refresh PR commits and ENS state. This does not update GitHub checks or approve a merge.');
      if (message && proof.snapshot) {
        text('name-status', 'Looking up the issuer’s primary ENS name…');
        const identity = await lookupIssuerName(reader.client, message.issuer, BigInt(proof.snapshot.block_number));
        if (ownRevision !== revision) return;
        if (mapReport) map.update({ ...mapReport, identity });
        text('vouched-by', 'Vouched by ' + (identity.name ?? message.issuer));
        text('name-status', identity.status === 'resolved'
          ? (identity.name === message.recordName ? 'Primary ENS name matches the publication name.' : 'The primary ENS name differs from the publication name below.')
          : identity.status === 'not_set' ? 'No primary ENS name is set. Showing the issuer address.'
            : 'Primary ENS name lookup is unavailable. Showing the issuer address; evidence is unchanged.');
      }
    } catch (error) {
      if (ownRevision !== revision) return;
      const code = error instanceof GitHubError ? error.code : 'verification_unavailable';
      const messages: Record<string, string> = {
        invalid_pr_url: 'Enter a public https://github.com/owner/repo/pull/number URL.',
        github_pr_unavailable: 'This PR could not be read. Check the URL and that its repository is public.',
        github_rate_limited: 'GitHub’s anonymous request limit was reached. Wait before retrying.',
        policy_missing: 'The PR’s base commit has no .devouch/policy.json. The receiving repository needs to adopt Devouch first.',
        invalid_policy: 'The base policy is not a supported Devouch policy.',
        policy_repository_mismatch: 'The base policy names a different repository.',
      };
      element('result').hidden = true; element('share').hidden = true;
      text('status', `${messages[code] ?? 'Verification could not finish. Try again after checking the connection.'} No decision was made (${code}).`);
    } finally {
      checking = false; controls.disabled = false; element('result').setAttribute('aria-busy', 'false');
    }
  }
  element('form').addEventListener('submit', event => { event.preventDefault(); void verify(); });
  input.addEventListener('input', invalidate);
  element('copy-link').addEventListener('click', async () => {
    const shared = element<HTMLInputElement>('share-url');
    try { await navigator.clipboard.writeText(shared.value); text('copy-status', 'Link copied.'); }
    catch { shared.focus(); shared.select(); text('copy-status', 'Select and copy the link above.'); }
  });
  return { invalidate, verify, setUrl: (value: string) => { input.value = value; } };
}
