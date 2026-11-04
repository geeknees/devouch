// ABOUTME: Connects ERC-8004 registration, mapping, feedback, and read-only verification to the static workspace.
// ABOUTME: Requires explicit wallet consent, persists uncertain sends, and displays independent evidence and policy results.
import type { EIP1193Provider, Hex } from 'viem';
import { Erc8004Reader, parseFeedbackReference, type FeedbackReference } from '../src/erc8004';
import { DEFAULT_DEPLOYMENT, DEFAULT_RPC, parseDeployment } from '../src/erc8004-deployment';
import { prepareTransaction, validateTransactionPlan, type TransactionPlan } from '../src/erc8004-operations';
import { evaluateErc8004Policy, parseErc8004Policy } from '../src/erc8004-policy';
import { strictJson } from '../src/json';
import { EvidenceError, insist } from '../src/errors';
import { verifyPullRequest } from '../src/pull-request';
import { Submission, validatePending, type Pending } from './submission';
import { WalletSession } from './wallet';

declare global { interface Window { ethereum?: EIP1193Provider } }
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const storageKey = 'devouch.erc8004.pending.v1';
let rpcUrl = DEFAULT_RPC, deployment = DEFAULT_DEPLOYMENT, plan: TransactionPlan | null = null;
let wallet: WalletSession | null = null, busy = false, recoveryCorrupt = false;
let downloaded: FeedbackReference | null = null, pending: Pending | null = null;
const reader = () => new Erc8004Reader(rpcUrl);
try { const saved = localStorage.getItem(storageKey); if (saved) pending = validatePending(strictJson(saved, 32768)); }
catch { recoveryCorrupt = true; }
const submission = new Submission(value => {
  if (value) localStorage.setItem(storageKey, JSON.stringify(value));
  else localStorage.removeItem(storageKey);
}, pending);
function status(message: string, error = false) {
  element('status').hidden = false; element('status').className = 'status ' + (error ? 'error' : 'success');
  element('status').textContent = message;
}
function render() {
  const current = submission.pending;
  element('pending-panel').hidden = !current;
  if (current) {
    element('pending-description').textContent = current.plan.operation + ' / chain ' + current.plan.deployment.chainId + ' / ' + current.plan.from;
    if (current.hash) input('recovery-hash').value = current.hash;
  }
  element('review').hidden = !plan;
  element<HTMLButtonElement>('send').disabled = busy || !plan || !input('consent').checked || !!current || recoveryCorrupt;
  element('deployment-description').textContent = 'Chain ' + deployment.chainId + ' · Identity: ' + deployment.registry.identityRegistry
    + ' · Reputation: ' + deployment.registry.reputationRegistry;
}
function invalidate() { plan = null; input('consent').checked = false; render(); }
function tab(name: string) {
  for (const node of document.querySelectorAll<HTMLElement>('[data-tab]')) {
    node.classList.toggle('active', node.dataset.tab === name);
    if (node.dataset.tab === name) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
  }
  for (const node of document.querySelectorAll<HTMLElement>('.panel')) node.hidden = node.id !== 'panel-' + name;
}
async function task(work: () => Promise<void>) {
  if (busy) return; busy = true; render();
  try { await work(); }
  catch (error) {
    const code = error instanceof EvidenceError ? error.code :
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'operation_unavailable';
    status(code.replaceAll('_', ' ') + (submission.pending ? '. Check the pending transaction before trying again.' : '.'), true);
  } finally { busy = false; render(); }
}
async function file(id: string, max = 32768) {
  const selected = input(id).files?.[0]; insist(selected && selected.size <= max, 'invalid_file');
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await selected.arrayBuffer());
}
function save(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function connected() {
  insist(window.ethereum, 'wallet_missing');
  if (!wallet) wallet = new WalletSession(window.ethereum, reader(), submission);
  if (!wallet.account) await wallet.connect();
  element('connect').textContent = wallet.account!.slice(0, 6) + '…' + wallet.account!.slice(-4);
  return wallet;
}
function review(value: TransactionPlan) {
  plan = validateTransactionPlan(value); input('consent').checked = false;
  const detail = element('review-details'); detail.replaceChildren();
  const rows: [string, string][] = [['Operation', plan.operation], ['Wallet', plan.from], ['Chain', String(plan.deployment.chainId)],
    ['Registry', plan.transaction.to], ['Agent ID', plan.agentId ?? 'New registration'], ['GitHub', plan.subject ?? '—']];
  if (plan.feedbackData) rows.push(['Feedback', plan.feedbackData]);
  if (plan.feedbackIndex) rows.push(['Index', plan.feedbackIndex]);
  for (const [name, value] of rows) {
    const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value; detail.append(dt, dd);
  }
  render(); status('Prepared. Review the operation and consent before submitting.');
  element('review').scrollIntoView({ block: 'nearest' });
}
function showReference(value: FeedbackReference) {
  downloaded = value; element('downloads').hidden = false;
  element('download-description').textContent = 'Agent ' + value.agentId + ' · feedback ' + value.feedbackIndex + ' · publication block ' + value.feedbackBlock;
}
async function recover() {
  insist(submission.pending, 'pending_transaction_missing');
  // Recovery only reads the chain and does not require a connected wallet.
  const session = new WalletSession(window.ethereum as EIP1193Provider, reader(), submission);
  const result = await session.recover(input('recovery-hash').value as Hex);
  invalidate();
  if (result.reference) showReference(result.reference);
  if (result.agentId !== undefined) input('map-agent').value = result.agentId;
  status(result.status === 'reverted' ? 'Transaction reverted. The registry operation did not complete. Pending state cleared; review the failure before preparing another operation.' :
    'Transaction mined and exact state read back.' + (result.agentId !== undefined ? ' Agent ID: ' + result.agentId : ''), result.status === 'reverted');
}
for (const node of document.querySelectorAll<HTMLElement>('[data-tab], [data-go]'))
  node.addEventListener('click', () => tab(node.dataset.tab ?? node.dataset.go!));
for (const id of ['prepare-form', 'map-form']) element(id).addEventListener('input', invalidate);
input('consent').addEventListener('change', render);
element('connect').addEventListener('click', () => task(async () => { await connected(); status('Wallet connected. No transaction submitted.'); }));
window.ethereum?.on('accountsChanged', () => { wallet = null; invalidate(); element('connect').textContent = 'Connect wallet ↗'; });
window.ethereum?.on('chainChanged', () => { wallet = null; invalidate(); });
element('prepare-form').addEventListener('submit', event => { event.preventDefault(); invalidate(); void task(async () => {
  const session = await connected(), expires = new Date(input('expires').value).getTime();
  insist(Number.isFinite(expires), 'invalid_expiry');
  review(await prepareTransaction(reader(), deployment, { operation: 'feedback', from: session.account!,
    agentId: input('agent-id').value, subject: 'github:' + input('subject-id').value, expiresAt: String(Math.floor(expires / 1000)) }));
}); });
element('register').addEventListener('click', () => { invalidate(); void task(async () => {
  const session = await connected(); review(await prepareTransaction(reader(), deployment, { operation: 'register', from: session.account! }));
}); });
element('map-form').addEventListener('submit', event => { event.preventDefault(); invalidate(); void task(async () => {
  const session = await connected(); review(await prepareTransaction(reader(), deployment, { operation: 'map', from: session.account!,
    agentId: input('map-agent').value, subject: 'github:' + input('map-subject').value }));
}); });
input('revoke-file').addEventListener('change', () => { invalidate(); void task(async () => {
  const reference = parseFeedbackReference(await file('revoke-file', 4096)), session = await connected();
  review(await prepareTransaction(reader(), deployment, { operation: 'revoke', from: session.account!, reference }));
}); });
input('request-file').addEventListener('change', () => { invalidate(); void task(async () => {
  review(validateTransactionPlan(strictJson(await file('request-file'), 32768)));
}); });
element('send').addEventListener('click', () => task(async () => {
  insist(plan && input('consent').checked && !recoveryCorrupt, 'consent_required');
  const session = await connected();
  const hash = await session.send(plan); input('recovery-hash').value = hash;
  status('Transaction submitted. Check the transaction to confirm its exact on-chain result.');
}));
element('recover').addEventListener('click', () => task(recover));
element('download-recovery').addEventListener('click', () => { if (submission.pending) save(submission.pending, 'devouch-recovery.json'); });
input('recovery-file').addEventListener('change', () => task(async () => {
  insist(!recoveryCorrupt, 'stored_recovery_unreadable'); submission.import(strictJson(await file('recovery-file'), 32768)); invalidate();
}));
element('download-reference').addEventListener('click', () => { if (downloaded) save(downloaded, 'devouch-feedback.json'); });
element('rpc-form').addEventListener('submit', event => { event.preventDefault(); void task(async () => {
  const url = new URL(input('rpc-url').value); insist(['http:', 'https:'].includes(url.protocol), 'invalid_rpc_url');
  rpcUrl = url.href; wallet = null; invalidate(); status('RPC endpoint selected. Reads begin when you choose an operation.');
}); });
input('deployment-file').addEventListener('change', () => task(async () => {
  const candidate = parseDeployment(await file('deployment-file', 8192));
  insist(!submission.pending, 'pending_transaction'); deployment = candidate; invalidate(); status('Deployment selected. Review its registry addresses before sending.');
}));
element('fetch-form').addEventListener('submit', event => { event.preventDefault(); void task(async () => {
  const reference = parseFeedbackReference(JSON.stringify({ format: 'devouch-erc8004-v1', chainId: deployment.chainId,
    identityRegistry: deployment.registry.identityRegistry, reputationRegistry: deployment.registry.reputationRegistry,
    agentId: input('fetch-agent').value, clientAddress: input('fetch-issuer').value,
    feedbackIndex: input('fetch-index').value, feedbackBlock: input('fetch-block').value }));
  await reader().fetch(reference); showReference(reference); status('Retrieved public feedback. Verify it against the receiving policy before use.');
}); });
element('verify-form').addEventListener('submit', event => { event.preventDefault(); element('verification-result').textContent = ''; void task(async () => {
  const reference = parseFeedbackReference(await file('verify-reference', 4096));
  const policy = parseErc8004Policy(await file('verify-policy', 16384));
  const evidence = await reader().inspect(reference, 'github:' + input('verify-subject').value);
  const decision = evaluateErc8004Policy(policy, evidence);
  element('verification-result').textContent = JSON.stringify({ ...evidence, ...decision, repository: policy.repositoryId }, null, 2);
  status('Evidence: ' + evidence.evidence_status + ' / Policy: ' + decision.policy_status);
}); });
element('verify-pr-form').addEventListener('submit', event => { event.preventDefault(); element('verification-result').textContent = ''; void task(async () => {
  const report = await verifyPullRequest(input('pr-url').value, reader());
  element('verification-result').textContent = JSON.stringify({ ...report.evidence, ...report.decision, subject: report.subject,
    repository: report.pullRequest.repository, baseSha: report.pullRequest.baseSha, headSha: report.pullRequest.headSha,
    policyDigest: report.policyDigest, githubAccountOwnership: 'not_verified', humanVerification: 'not_included' }, null, 2);
  status('Evidence: ' + report.evidence.evidence_status + ' / Policy: ' + report.decision.policy_status);
}); });
input('rpc-url').value = rpcUrl;
const expiry = new Date(Date.now() + 30 * 86400000); expiry.setMinutes(expiry.getMinutes() - expiry.getTimezoneOffset());
input('expires').value = expiry.toISOString().slice(0, 19);
if (recoveryCorrupt) status('Saved recovery data could not be read. Wallet submission is blocked; preserve the browser data and use another browser to import a valid recovery file.', true);
render();
