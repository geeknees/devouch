// ABOUTME: Lets maintainers review live endorsements and explicitly choose their repository's trust.
// ABOUTME: Exports reviewable policy and a published SHA-pinned workflow without writing to GitHub.
import { ChainReader } from '../src/chain';
import { EvidenceError, insist } from '../src/errors';
import { lookupIssuerName } from '../src/identity';
import { buildOnboarding } from '../src/onboarding';
import type { PolicyEvidence } from '../src/policy';

type Hooks = { rpc: () => string; busy: () => boolean; run: (message: string, work: () => Promise<void>) => Promise<void>;
  status: (message: string, tone?: 'neutral' | 'success' | 'error') => void; download: (name: string, contents: string) => void };
const element = (id: string) => document.getElementById(id)!;
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
type Candidate = { evidence: PolicyEvidence; selected: HTMLInputElement };

export function initializeMaintainers(hooks: Hooks) {
  let candidates: Candidate[] = [], prepared: ReturnType<typeof buildOnboarding> | null = null;
  function update() {
    const ready = prepared !== null && field('maintainer-consent').checked && !hooks.busy();
    for (const id of ['maintainer-policy-download', 'maintainer-workflow-download']) (element(id) as HTMLButtonElement).disabled = !ready;
  }
  function preview() {
    prepared = null;
    try {
      prepared = buildOnboarding(field('maintainer-repository').value.trim(), field('maintainer-action-sha').value.trim(),
        candidates.filter(candidate => candidate.selected.checked).map(candidate => candidate.evidence));
      element('maintainer-policy-preview').textContent = JSON.stringify(prepared.policy, null, 2);
      element('maintainer-workflow-preview').textContent = prepared.workflow;
      element('maintainer-export').hidden = false;
      element('maintainer-selection-status').textContent = 'Review the selected issuer addresses, scopes, and resolvers. No repository has been changed.';
    } catch (error) {
      element('maintainer-export').hidden = true;
      element('maintainer-selection-status').textContent = error instanceof EvidenceError ? error.code : 'invalid_configuration';
    }
    update();
  }
  const invalidate = () => { candidates = []; prepared = null; field('maintainer-consent').checked = false;
    element('maintainer-candidates').replaceChildren(); element('maintainer-export').hidden = true;
    element('maintainer-selection-status').textContent = 'Check the publication names, then select the issuers you independently trust.'; update(); };
  field('maintainer-names').addEventListener('input', invalidate);
  for (const id of ['maintainer-repository', 'maintainer-action-sha']) field(id).addEventListener('input', () => {
    field('maintainer-consent').checked = false; preview();
  });
  field('maintainer-consent').addEventListener('change', update);
  element('maintainer-check').addEventListener('click', () => void hooks.run('Checking the publication names before you choose trusted issuers…', async () => {
    invalidate();
    const names = [...new Set(field('maintainer-names').value.split(/[\s,]+/).filter(Boolean))];
    insist(names.length > 0 && names.length <= 8, 'invalid_namespace_list');
    for (const name of names) {
      const card = document.createElement('section'); card.className = 'maintainer-candidate';
      const heading = document.createElement('h4'); heading.textContent = name; card.append(heading);
      try {
        const reader = new ChainReader(hooks.rpc()), result = await reader.verifyName(name);
        const proof = result.evidence, message = result.parsed.message;
        const identity = await lookupIssuerName(reader.client, message.issuer, BigInt(proof.snapshot.block_number));
        const info = document.createElement('p'); info.className = 'hierarchy-details';
        info.textContent = `Vouched by ${identity.name ?? message.issuer}\nIssuer: ${message.issuer}\nSubject: ${message.subject}\nScope: ${message.scope}\nResolver: ${message.resolver}\nEvidence: ${proof.evidence_status}${proof.reason_codes.length ? ' · ' + proof.reason_codes.join(', ') : ''}\nChecked block: ${proof.snapshot.block_number}`;
        card.append(info);
        if (proof.evidence_status === 'valid') {
          const label = document.createElement('label'); label.className = 'consent';
          const selected = document.createElement('input'); selected.type = 'checkbox'; selected.dataset.maintainerSelect = name;
          const description = document.createElement('span'); description.textContent = 'Accept this issuer’s recommendations for this scope and resolver.';
          label.append(selected, description); card.append(label);
          candidates.push({ evidence: { ...proof, issuer: message.issuer, scope: message.scope, resolver: message.resolver }, selected });
          selected.addEventListener('change', () => { field('maintainer-consent').checked = false; preview(); });
        }
      } catch (error) {
        const reason = document.createElement('p'); reason.textContent = error instanceof EvidenceError
          ? `${error.status}: ${error.code}` : 'unavailable: verification_unavailable'; card.append(reason);
      }
      element('maintainer-candidates').append(card);
    }
    hooks.status('Endorsements checked. Valid evidence does not choose trusted issuers for you. Select only recommendations your repository will accept.', 'success');
    preview();
  }));
  const exportFile = (name: string, content: () => string) => {
    insist(prepared && field('maintainer-consent').checked, 'consent_required'); hooks.download(name, content());
    hooks.status('Configuration downloaded. Review and commit both files through your repository’s normal review process.', 'success');
  };
  element('maintainer-policy-download').addEventListener('click', () => exportFile('policy.json', () => JSON.stringify(prepared!.policy, null, 2) + '\n'));
  element('maintainer-workflow-download').addEventListener('click', () => exportFile('devouch.yml', () => prepared!.workflow));
  update(); return { update, invalidate };
}
