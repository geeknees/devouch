// ABOUTME: Displays locally saved publication names with fresh, full endorsement verification.
// ABOUTME: Keeps agent permissions separate and removes only browser list entries, never ENS records.
import { ChainReader, type Publication } from '../src/chain';
import { strictJson } from '../src/credential';
import { addSavedName, inspectSavedName, parseSavedNames, SAVED_NAMES_KEY, type SavedName } from '../src/endorsement-list';
import { EvidenceError } from '../src/errors';
import { lookupIssuerName } from '../src/identity';
import { publicationHint } from '../src/operations';
import { diagnosticReason } from '../src/rpc-errors';
import { expirySummary } from './expiry';
import { verificationUrl } from './verify';

type Verified = Awaited<ReturnType<ChainReader['verifyName']>>;
type Agent = Awaited<ReturnType<ChainReader['readAgent']>>;
type Result = { state: string; reason?: string; verified?: Verified; usedSavedPublication?: boolean; issuerName?: string;
  agent?: Agent; agentReason?: string };
type Context = { rpc(): string; busy(): boolean; run(message: string, work: () => Promise<void>): Promise<void>;
  status(message: string): void };
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const field = (id: string) => element<HTMLInputElement>(id);

export function initializeManagement(context: Context) {
  let names: SavedName[] = [], canSave = true, refreshing = false, stop = false;
  const results = new Map<string, Result>();
  try { const raw = localStorage.getItem(SAVED_NAMES_KEY); if (raw) names = parseSavedNames(raw); }
  catch { canSave = false; }

  function persist() {
    if (!canSave) return;
    try { localStorage.setItem(SAVED_NAMES_KEY, JSON.stringify({ version: 1, names })); }
    catch { canSave = false; }
  }
  function update() {
    element<HTMLButtonElement>('manage-refresh').disabled = context.busy() || names.length === 0;
    element<HTMLButtonElement>('manage-stop').hidden = !refreshing;
    element<HTMLButtonElement>('manage-stop').disabled = !refreshing || stop;
    element('manage-storage').textContent = canSave
      ? `${names.length} / 8 names saved in this browser. Results are checked on request and are not saved.`
      : 'Browser storage is unavailable or its saved list could not be read. Changes stay in this tab only; existing saved data is preserved.';
  }
  function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
    const value = document.createElement(tag);
    if (text) value.textContent = text;
    if (className) value.className = className;
    return value;
  }
  function details(fields: [string, string][]) {
    const list = node('dl', undefined, 'details management-details');
    for (const [label, value] of fields) list.append(node('dt', label), node('dd', value));
    return list;
  }
  function action(label: string, callback: () => void) {
    const button = node('button', label, 'button secondary');
    button.type = 'button'; button.disabled = context.busy(); button.addEventListener('click', callback);
    return button;
  }
  function render() {
    const list = element('manage-list'); list.replaceChildren();
    element('manage-empty').hidden = names.length !== 0;
    for (const saved of names) {
      const result = results.get(saved.name) ?? { state: 'not_checked' };
      const card = node('article', undefined, 'management-card'); card.dataset.savedName = saved.name;
      const top = node('div', undefined, 'management-card-top');
      const state = node('span', result.state, 'verdict'); state.dataset.evidenceState = ''; state.dataset.state = result.state;
      top.append(node('h4', saved.name), state); card.append(top);
      if (result.reason) card.append(node('p', result.reason, 'field-note'));
      const verified = result.verified;
      if (verified) {
        const m = verified.parsed.message, snapshot = verified.evidence.snapshot;
        card.append(node('p', 'Vouched by ' + (result.issuerName ?? m.issuer), 'management-issuer'));
        const expiry = expirySummary(m.expiresAt, snapshot.block_timestamp);
        const remaining = node('p', undefined, 'management-expiry');
        remaining.dataset.expirySummary = ''; remaining.dataset.expiryState = expiry.state;
        remaining.append(node('strong', (expiry.state === 'soon' ? 'Expiring soon · ' : '') + expiry.text), node('span', 'At last check'));
        card.append(remaining);
        card.append(details([['Subject', m.subject], ['Scope', m.scope], ['Expires (UTC)', new Date(Number(m.expiresAt) * 1000).toISOString()],
          ['Policy', 'not_evaluated — choose a repository in Verify'], ['Snapshot block', snapshot.block_number], ['Checked at', snapshot.checked_at]]));
        if (result.usedSavedPublication) card.append(node('p', 'Saved publication checked because no current record was found.', 'field-note'));
      } else card.append(node('p', 'Policy: not_evaluated. Refresh to check current evidence.', 'field-note'));
      const agentResult = node('div', undefined, 'management-agent'); agentResult.dataset.agentResult = '';
      if (result.agent) {
        const agent = result.agent;
        const grants = Object.entries(agent.permissions).filter(([, granted]) => granted).map(([key]) => key).join(', ') || 'None';
        agentResult.append(details([['Agent subject', agent.identity.subject], ['Agent wallet', agent.identity.wallet],
          ['Permitted profile fields', grants], ['Agent snapshot block', agent.snapshot.block_number], ['Agent checked at', agent.snapshot.checked_at]]));
        agentResult.append(node('p', 'Controller-declared identity; account ownership is not verified.', 'field-note'));
      } else agentResult.append(node('p', result.agentReason ?? 'Agent permissions: not_checked', 'field-note'));
      card.append(agentResult);
      const actions = node('div', undefined, 'form-actions');
      actions.append(action('Refresh evidence', () => void context.run('Refreshing ' + saved.name + '…', async () => {
        await refresh(saved); context.status('Evidence check finished. Read the result and its snapshot below.');
      })));
      actions.append(action('Check agent permissions', () => void context.run('Reading agent identity and profile grants…', async () => {
        const current: Result = results.get(saved.name) ?? { state: 'not_checked' };
        current.agent = undefined; current.agentReason = 'Checking agent permissions…'; results.set(saved.name, current); render();
        try { current.agent = await new ChainReader(context.rpc()).readAgent(saved.name); current.agentReason = undefined; }
        catch (error) {
          current.agentReason = error instanceof EvidenceError && error.code === 'agent_identity_missing'
            ? 'No controller-declared agent identity is published at this name.'
            : 'Agent permissions could not be verified: ' + diagnosticReason(error);
        }
        render(); context.status('Agent inspection finished. Its result is separate from endorsement evidence.');
      })));
      const verify = node('a', 'Verify & compare');
      verify.href = verificationUrl(location.href, saved.name, result.usedSavedPublication ? saved.publication : undefined);
      actions.append(verify);
      const agent = node('a', 'Manage agent permissions');
      const agentUrl = new URL(location.href); agentUrl.search = ''; agentUrl.searchParams.set('agent', saved.name); agentUrl.hash = 'namespaces';
      agent.href = agentUrl.href; actions.append(agent);
      const remove = action('Remove from list', () => {
        names = names.filter(row => row.name !== saved.name); results.delete(saved.name); persist(); render();
      });
      remove.className = 'text-button'; actions.append(remove); card.append(actions); list.append(card);
    }
    update();
  }
  async function refresh(saved: SavedName) {
    results.set(saved.name, { state: 'checking' }); render();
    try {
      const reader = new ChainReader(context.rpc());
      const inspected = await inspectSavedName(saved, (name, hint) => reader.verifyName(name, hint));
      const verified = inspected.verified;
      saved.publication = verified.publication; persist();
      const result: Result = { state: verified.evidence.evidence_status, verified, usedSavedPublication: inspected.usedSavedPublication,
        reason: verified.evidence.reason_codes.join(', ') };
      results.set(saved.name, result); render();
      const identity = await lookupIssuerName(reader.client, verified.parsed.message.issuer, BigInt(verified.snapshot.block_number));
      result.issuerName = identity.name ?? undefined;
    } catch (error) {
      results.set(saved.name, { state: error instanceof EvidenceError ? error.status : 'unavailable', reason: diagnosticReason(error) });
    }
    render();
  }
  element('manage-form').addEventListener('submit', event => {
    event.preventDefault();
    void context.run('Adding this publication name to your list…', async () => {
      const file = field('manage-publication').files?.[0];
      let publication: Publication | undefined;
      if (file) {
        if (file.size > 2048) throw new EvidenceError('invalid_publication');
        publication = publicationHint(strictJson(await file.text(), 2048));
      }
      names = addSavedName(names, field('manage-name').value.trim(), publication);
      persist(); field('manage-name').value = ''; field('manage-publication').value = ''; render();
      context.status('Name added to this browser’s list. Refresh evidence to check the endorsement.');
    });
  });
  element('manage-refresh').addEventListener('click', () => void context.run('Refreshing saved endorsements sequentially…', async () => {
    refreshing = true; stop = false; update();
    try { for (const saved of names) { if (stop) break; await refresh(saved); } }
    finally { refreshing = false; update(); context.status(stop ? 'Stopped after the current name. Check each result’s timestamp.'
      : 'Saved-name checks finished. Each result shows its own snapshot.'); }
  }));
  element('manage-stop').addEventListener('click', () => { stop = true; update(); });
  render();
  return { update, invalidate() { results.clear(); render(); } };
}
