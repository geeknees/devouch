// ABOUTME: Presents wallet-free verification by ENS name or public GitHub PR with separate policy views.
// ABOUTME: Reuses the complete chain verifier and keeps names, evidence, and local acceptance separate.
import { ChainReader, type Publication } from '../src/chain';
import { strictJson } from '../src/credential';
import { EvidenceError } from '../src/errors';
import { lookupIssuerName } from '../src/identity';
import { publicationHint } from '../src/operations';
import { evaluatePolicy, parsePolicy, type PolicyEvidence } from '../src/policy';
import { initializePullRequestVerification } from './verify-pr';

type Verified = Awaited<ReturnType<ChainReader['verifyName']>>;
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const field = (id: string) => element<HTMLInputElement>(id);
const text = (id: string, value: string) => { element(id).textContent = value; };
const instant = (seconds: string) => {
  const date = new Date(Number(seconds) * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : seconds + ' (Unix seconds)';
};

export function verificationUrl(base: string, name: string, publication?: Publication) {
  const url = new URL(base);
  url.search = ''; url.hash = 'verify';
  url.searchParams.set('name', name);
  if (publication) url.searchParams.set('publication', JSON.stringify(publication));
  return url.href;
}

export function initializeVerification(getRpc: () => string) {
  const pullRequest = initializePullRequestVerification(getRpc);
  let verified: Verified | null = null, evidence: PolicyEvidence | null = null;
  let checking = false, revision = 0, linkPublication: Publication | undefined;
  const controls = element<HTMLFieldSetElement>('verify-inputs');
  const panel = element('panel-verify');
  const status = (message: string) => { text('verify-status', message); };

  function compare() {
    for (const side of ['a', 'b']) {
      const prefix = 'verify-policy-' + side;
      let decision = { policy_status: 'not_evaluated', reason_codes: evidence?.reason_codes ?? [] };
      if (verified && evidence) {
        const m = verified.parsed.message;
        try {
          const issuers = element<HTMLTextAreaElement>(prefix + '-issuers').value.split(/[\s,]+/).filter(Boolean);
          const policy = parsePolicy(JSON.stringify({ repositoryId: 'demo/repo-' + side, chainId: 11155111,
            trustedIssuers: issuers, allowedScopes: [m.scope],
            allowedResolvers: [{ address: m.resolver, implementation: verified.evidence.implementation }], requiredIssuers: 1 }));
          decision = evaluatePolicy(policy, evidence);
        } catch { decision = { policy_status: 'not_evaluated', reason_codes: ['invalid_policy'] }; }
      }
      text(prefix + '-status', decision.policy_status);
      element(prefix + '-status').dataset.state = decision.policy_status;
      text(prefix + '-reasons', decision.reason_codes.join(', ') || (decision.policy_status === 'accepted'
        ? 'The issuer, scope, and resolver match this example policy.' : 'Verify an endorsement first.'));
      element<HTMLTextAreaElement>(prefix + '-issuers').disabled = !verified;
      panel.querySelector<HTMLButtonElement>('[data-trust-issuer="' + side + '"]')!.disabled = !verified;
    }
  }

  function clear() {
    revision++; verified = null; evidence = null;
    element('verify-result').hidden = true;
    element('verify-record').hidden = true;
    element('verify-share').hidden = true;
    element('verify-vouched-by').hidden = true;
    text('verify-name-status', '');
    compare();
  }
  function invalidate() {
    clear(); status('Ready to check this name. Each verification reads a fresh Sepolia snapshot.');
  }

  async function verify() {
    if (checking) return;
    clear();
    const ownRevision = revision, name = field('verify-name').value.trim();
    checking = true; controls.disabled = true;
    element('verify-result').setAttribute('aria-busy', 'true');
    status('Checking the signature, ENS publication history, and a fresh Sepolia snapshot…');
    try {
      const file = field('verify-publication-file').files?.[0];
      let hint = linkPublication;
      if (file) {
        if (file.size > 2048) throw new EvidenceError('invalid_publication');
        hint = publicationHint(strictJson(await file.text(), 2048));
      }
      const reader = new ChainReader(getRpc());
      const result = await reader.verifyName(name, hint);
      if (ownRevision !== revision) return;
      verified = result;
      const m = result.parsed.message, proof = result.evidence;
      evidence = { ...proof, issuer: m.issuer, scope: m.scope, resolver: m.resolver };
      text('verify-evidence-status', proof.evidence_status);
      element('verify-evidence-status').dataset.state = proof.evidence_status;
      text('verify-signature-status', 'valid');
      text('verify-evidence-reasons', proof.reason_codes.join(', ') || 'Signature, publication history, and snapshot checks passed.');
      text('verify-vouched-by', 'Vouched by ' + m.issuer);
      element('verify-vouched-by').hidden = false;
      text('verify-issuer-address', m.issuer);
      text('verify-record-name', m.recordName);
      text('verify-subject', m.subject); text('verify-scope', m.scope);
      text('verify-expiry', instant(m.expiresAt));
      text('verify-block', proof.snapshot.block_number);
      text('verify-block-hash', proof.snapshot.block_hash);
      text('verify-checked-at', proof.snapshot.checked_at);
      text('verify-resolver', m.resolver);
      text('verify-name-status', 'Looking up the issuer’s primary ENS name…');
      element<HTMLTextAreaElement>('verify-policy-a-issuers').value = m.issuer;
      element<HTMLTextAreaElement>('verify-policy-b-issuers').value = '';
      const link = verificationUrl(location.href, name, hint);
      element<HTMLAnchorElement>('verify-share-link').href = link;
      field('verify-share-url').value = link;
      text('verify-copy-status', '');
      element('verify-share').hidden = false;
      element('verify-record').hidden = false;
      element('verify-result').hidden = false;
      compare();
      try { history.replaceState(null, '', link); } catch { /* Sharing still works when history access is restricted. */ }
      status('Evidence checked at the block below. Edit either example policy to compare decisions on this same evidence.');
      const identity = await lookupIssuerName(reader.client, m.issuer, BigInt(proof.snapshot.block_number));
      if (ownRevision !== revision) return;
      text('verify-vouched-by', 'Vouched by ' + (identity.name ?? m.issuer));
      text('verify-name-status', identity.status === 'resolved'
        ? (identity.name === m.recordName ? 'Primary ENS name matches the publication name.' : 'The issuer’s primary ENS name differs from the publication name shown below.')
        : identity.status === 'not_set' ? 'No matching primary ENS name is set. Showing the issuer address.'
          : 'Primary ENS name lookup is unavailable. Showing the issuer address; evidence is unchanged.');
    } catch (error) {
      if (ownRevision !== revision) return;
      const failure = error instanceof EvidenceError ? error : new EvidenceError('verification_unavailable', 'unavailable');
      evidence = { evidence_status: failure.status, reason_codes: [failure.code] };
      text('verify-evidence-status', failure.status);
      element('verify-evidence-status').dataset.state = failure.status;
      text('verify-signature-status', failure.code === 'invalid_signature' ? 'invalid' : 'not_verified');
      text('verify-evidence-reasons', failure.code);
      element('verify-result').hidden = false;
      compare();
      status(failure.status === 'missing'
        ? 'No current endorsement was found. To check a withdrawn publication, load its saved publication position.'
        : failure.status === 'unavailable' ? 'Verification could not finish. Retry or choose another Sepolia RPC in Connection settings.'
          : 'Verification did not succeed. Check the name and optional publication position.');
    } finally {
      checking = false; controls.disabled = false;
      element('verify-result').setAttribute('aria-busy', 'false');
    }
  }

  element('verify-form').addEventListener('submit', event => { event.preventDefault(); void verify(); });
  field('verify-name').addEventListener('input', invalidate);
  field('verify-publication-file').addEventListener('change', invalidate);
  element('verify-clear-publication').addEventListener('click', () => {
    linkPublication = undefined; field('verify-publication-file').value = '';
    text('verify-publication-note', 'Without a saved position, verification starts from the current ENS record.');
    invalidate();
  });
  for (const side of ['a', 'b']) {
    element('verify-policy-' + side + '-issuers').addEventListener('input', compare);
    panel.querySelector('[data-trust-issuer="' + side + '"]')!.addEventListener('click', () => {
      if (!verified) return;
      const target = element<HTMLTextAreaElement>('verify-policy-' + side + '-issuers'), issuer = verified.parsed.message.issuer;
      const issuers = target.value.split(/[\s,]+/).filter(Boolean);
      if (!issuers.some(value => value.toLowerCase() === issuer.toLowerCase())) issuers.push(issuer);
      target.value = issuers.join('\n'); compare();
    });
  }
  element('verify-copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(field('verify-share-url').value); text('verify-copy-status', 'Link copied.'); }
    catch { field('verify-share-url').focus(); field('verify-share-url').select(); text('verify-copy-status', 'Select and copy the link above.'); }
  });
  function activateMode(mode: 'name' | 'pr') {
    invalidate(); pullRequest.invalidate();
    element('verify-name-view').hidden = mode !== 'name';
    element('verify-pr-view').hidden = mode !== 'pr';
    panel.querySelectorAll<HTMLButtonElement>('[data-verify-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.verifyMode === mode));
    });
    text('verify-heading', mode === 'pr' ? 'Check a pull request’s endorsement.' : 'One endorsement. Two independent decisions.');
    text('verify-intro', mode === 'pr' ? 'Check the PR author’s endorsement against the receiving repository’s policy.'
      : 'Check live ENS evidence. See what changes when a repository trusts its issuer.');
  }
  panel.querySelectorAll<HTMLButtonElement>('[data-verify-mode]').forEach(button => {
    button.addEventListener('click', () => activateMode(button.dataset.verifyMode as 'name' | 'pr'));
  });
  if (location.hash === '#verify' && new URLSearchParams(location.search).has('pr')) {
    activateMode('pr');
    pullRequest.setUrl(new URLSearchParams(location.search).get('pr')!);
    void pullRequest.verify();
  } else if (location.hash === '#verify') {
    const query = new URLSearchParams(location.search);
    const name = query.get('name');
    if (name) field('verify-name').value = name;
    try {
      if (query.has('publication')) {
        linkPublication = publicationHint(strictJson(query.get('publication')!, 2048));
        text('verify-publication-note', 'A saved publication position was loaded from this link.');
      }
      if (name) void verify();
    } catch {
      status('The publication position in this link is invalid. Clear it or load a valid publication.json file.');
    }
  }
  return { invalidate: () => { invalidate(); pullRequest.invalidate(); } };
}
