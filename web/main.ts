// ABOUTME: Connects the static workspace to shared endorsement and direct-wallet operations.
// ABOUTME: Renders public data as text and keeps signing, publishing, and recovery visibly separate.
import type { Address, EIP1193Provider, Hex } from 'viem';
import { ChainReader, type Publication } from '../src/chain';
import { address, parseCredential, strictJson } from '../src/credential';
import { DEFAULT_RPC, RESOLVER_IMPL } from '../src/ens';
import { EvidenceError, insist } from '../src/errors';
import { makeRequest, makeRevoke, publicationHint, validatePublishRequest, validateRevokeRequest,
  type PublishRequest, type RevokeRequest } from '../src/operations';
import { isWalletRejection, Submission, validatePending, type Pending } from './submission';
import { WalletSession } from './wallet';
import { initializeVerification } from './verify';
import { initializeNamespaces } from './namespaces';
import { initializeMaintainers } from './maintainers';

declare global { interface Window { ethereum?: EIP1193Provider & { on?: (event: string, listener: () => void) => void } } }
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const button = (id: string) => element<HTMLButtonElement>(id);
let rpcUrl = DEFAULT_RPC, busy = false, session: WalletSession | null = null;
let publishRequest: PublishRequest | null = null, signedRaw: string | null = null, revokeRequest: RevokeRequest | null = null;
let downloadedRaw: string | null = null, downloadedPublication: Publication | null = null;
const storageKey = 'devouch.pending.v1';
const writeButtons = ['prepare', 'sign', 'publish', 'revoke', 'deploy', 'bind', 'grant', 'remove'];
let damagedRecovery = false;
let maintainers: ReturnType<typeof initializeMaintainers> | null = null;

function restorePending(): Pending | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return validatePending(strictJson(raw, 32768));
  } catch { damagedRecovery = true; return null; }
}
const submission = new Submission(value => {
  if (value) localStorage.setItem(storageKey, JSON.stringify(value)); else localStorage.removeItem(storageKey);
  update();
}, restorePending());

function status(message: string, tone: 'neutral' | 'success' | 'error' | 'withdrawn' = 'neutral') {
  const target = element('status');
  target.hidden = false;
  for (const value of ['success', 'error', 'withdrawn']) target.classList.toggle(value, tone === value);
  target.textContent = message;
}
function update() {
  for (const target of document.querySelectorAll<HTMLButtonElement>('button:not(#theme-toggle)')) target.disabled = busy;
  for (const target of document.querySelectorAll<HTMLInputElement>('input, select, textarea')) target.disabled = busy;
  if (submission.pending || damagedRecovery) for (const id of writeButtons) button(id).disabled = true;
  if (submission.pending || damagedRecovery) for (const target of document.querySelectorAll<HTMLButtonElement>('[data-wallet-write]')) target.disabled = true;
  button('sign').disabled ||= !publishRequest || !input('consent').checked;
  button('publish').disabled ||= !signedRaw || !input('consent').checked;
  button('revoke').disabled ||= !revokeRequest || !input('revoke-consent').checked;
  button('bind').disabled ||= !input('bind-consent').checked;
  button('namespace-record-bind').disabled ||= !input('namespace-record-consent').checked;
  element('pending-panel').hidden = !submission.pending && !damagedRecovery;
  if (damagedRecovery) element('pending-description').textContent = 'The saved operation cannot be read. Sending is blocked. Load its recovery file in Connection settings and check your wallet history.';
  if (submission.pending) {
    element('pending-description').textContent = 'Pending ' + submission.pending.kind + ' for ' + submission.pending.name + '. Sending again is disabled until its outcome is checked.';
    if (submission.pending.hash) input('recovery-hash').value = submission.pending.hash;
  }
  button('connect').textContent = session?.account ? session.account.slice(0, 6) + '…' + session.account.slice(-4) : 'Connect wallet ↗';
  maintainers?.update();
}
function errorMessage(error: unknown) {
  const code = isWalletRejection(error) ? 'wallet_rejected'
    : error instanceof EvidenceError ? error.code : error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    wallet_unavailable: 'Open this workspace in a browser with an Ethereum wallet extension.',
    wallet_rejected: 'The wallet request was cancelled. Nothing was submitted by this operation.',
    submission_unknown: 'The submission outcome is unknown. Check your wallet history, then use transaction recovery.',
    pending_transaction: 'Check the pending transaction before starting another operation.',
    publication_changed: 'The public record changed. Retrieve it again and review a new request.',
    publication_missing: 'No endorsement is published at this name.',
    wallet_mismatch: 'Connect the issuer wallet shown in this request.',
    wallet_changed: 'The wallet account changed. Reconnect and review the operation again.',
    issuer_does_not_control_name: 'The connected wallet must own this ENS name.',
    issuer_cannot_publish: 'This wallet does not control the dedicated resolver. Check ENS setup.',
    unsupported_resolver: 'This name needs a supported dedicated ENSv2 resolver. Open ENS setup.',
    unsupported_implementation: 'This resolver implementation is not supported by this release.',
    unsupported_namespace: 'Use a direct name.eth name or an issuer-owned ENSv2 subname on Sepolia.',
    record_not_initialized: 'Initialize a dedicated resolver for this name in ENS setup.',
    name_expires_before_endorsement: 'Choose an expiry before the ENS name expires, or renew the name first.',
    chain_mismatch: 'Use Sepolia in both the wallet and the RPC connection.',
    rpc_unavailable: 'The RPC could not complete this check. Try another connection; no successful verification is implied.',
    history_budget_exceeded: 'This record exceeds the bounded history budget. See the protocol guide before creating a fresh publishing record.',
    stale_snapshot: 'The RPC returned stale chain state. Use another Sepolia connection.',
    invalid_format: 'This file or field is not a valid Devouch v1 request or endorsement.',
    invalid_signature: 'The endorsement signature does not match its issuer and contents.',
    consent_required: 'Review the details and confirm your intent before continuing.',
    expired: 'This endorsement has expired. Prepare a new one with a new identifier.',
    revoked: 'This endorsement is already withdrawn. Old signatures cannot be reactivated.',
    resolver_upgraded: 'This resolver has an upgrade history that this release cannot accept.',
    registry_upgraded: 'This child registry has an upgrade history that this release cannot accept.',
    unsupported_registry: 'Use an official ENSv2 UserRegistry for the subname hierarchy.',
    subregistry_missing: 'Create and connect a child registry before registering a subname.',
    subregistry_already_connected: 'A child registry is already connected. Inspect the parent and use its existing registry.',
    registry_parent_mismatch: 'Set this child registry’s parent link before connecting it.',
    name_already_registered: 'That label is already registered. Inspect the existing subname or choose another label.',
    invalid_namespace_label: 'Enter one normalized label without dots.',
    invalid_expiry: 'Choose a future expiry within every parent name’s expiry.',
    invalid_agent_subject: 'Enter the agent’s numeric GitHub ID in the agent identity fields. Example: 287365775. The name or github: prefix is not needed.',
    invalid_agent_wallet: 'Enter the agent’s full public wallet address in the agent identity fields, or uncheck Include an agent identity.',
    agent_identity_missing: 'This resolver has no controller-published agent identity.',
    agent_identity_mismatch: 'The agent identity does not match the name, controller, or wallet.',
    agent_resolver_shared: 'This agent needs a resolver used only for its own name. A shared text-key grant would also affect other records.',
    agent_permission_missing: 'This wallet does not have permission to edit that profile field.',
    unsupported_agent_permission: 'Agent grants support only url, avatar, and description.',
    invalid_namespace_list: 'Enter between one and eight publication ENS names.',
    transaction_reverted: 'The transaction reverted. No successful update was recorded.',
  };
  if (messages[code]) return messages[code];
  if (submission.pending) return 'The operation is not confirmed. Use the saved transaction details to check its outcome before resubmitting.';
  return 'The operation could not be completed. Check the file, wallet, and RPC connection.';
}
async function run(message: string, work: () => Promise<void>) {
  if (busy) return;
  busy = true; update(); status(message);
  try { await work(); } catch (error) {
    const unavailable = error instanceof EvidenceError &&
      ['rpc_unavailable', 'wallet_unavailable', 'submission_unknown', 'pending_transaction'].includes(error.code);
    status(errorMessage(error), unavailable ? 'neutral' : 'error');
  }
  finally { busy = false; update(); }
}
function wallet() {
  if (!session) {
    insist(window.ethereum, 'wallet_unavailable');
    session = new WalletSession(rpcUrl, window.ethereum, submission);
  }
  return session;
}
async function connected() {
  const current = wallet();
  if (!current.account) await current.connect();
  return current;
}
function activate(tab: string) {
  document.body.dataset.view = tab;
  for (const target of document.querySelectorAll<HTMLElement>('.panel')) target.hidden = target.id !== 'panel-' + tab;
  for (const target of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    const selected = target.dataset.tab === tab;
    target.classList.toggle('active', selected);
    if (selected) target.setAttribute('aria-current', 'page'); else target.removeAttribute('aria-current');
  }
}
function details(id: string, fields: [string, string][]) {
  const target = element(id); target.replaceChildren();
  for (const [label, value] of fields) {
    const term = document.createElement('dt'), definition = document.createElement('dd');
    term.textContent = label; definition.textContent = value;
    target.append(term, definition);
  }
}
function clearReview() {
  publishRequest = null; signedRaw = null;
  input('consent').checked = false;
  element('review').hidden = true;
}
function localDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}
function review(request: PublishRequest) {
  publishRequest = request; signedRaw = null;
  input('consent').checked = false;
  const m = request.message;
  input('publish-name').value = m.recordName;
  input('subject-id').value = m.subject.split(':')[1]!;
  input('expires').value = localDateTime(new Date(Number(m.expiresAt) * 1000));
  details('review-details', [['Contributor', m.subject], ['Issuer', m.issuer], ['Purpose', m.scope],
    ['Expires', new Date(Number(m.expiresAt) * 1000).toISOString()], ['ENS name', m.recordName], ['Resolver', m.resolver]]);
  element('replacement').hidden = request.previousValue === '';
  element('replacement').textContent = 'Publishing replaces the endorsement currently in this record. The previous endorsement will remain withdrawn, even if its JSON is restored later.';
  element('review').hidden = false;
  element('signature-status').textContent = 'Unsigned and unpublished. Confirm your recommendation before signing.';
  activate('publish'); update();
}
async function fileText(id: string, maximum = 16384) {
  const file = input(id).files?.[0];
  insist(file && file.size <= maximum, 'invalid_format');
  return file.text();
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function downloads(raw: string, publication: Publication) {
  const parsed = await parseCredential(raw);
  downloadedRaw = raw; downloadedPublication = publication;
  element('downloads').hidden = false;
  element('download-description').textContent = 'Published at block ' + publication.blockNumber + '. Retrieval does not confirm current validity.';
  details('download-details', [['Contributor', parsed.message.subject], ['Issuer', parsed.message.issuer],
    ['Purpose', parsed.message.scope], ['Expires (UTC)', new Date(Number(parsed.message.expiresAt) * 1000).toISOString()],
    ['ENS name', parsed.message.recordName], ['Resolver', parsed.message.resolver]]);
  element<HTMLAnchorElement>('publication-link').href = 'https://sepolia.etherscan.io/tx/' + publication.transactionHash;
  element('credential-path').textContent = '.devouch/vouches/github-' + parsed.message.subject.split(':')[1] + '.json';
}
async function completed(result: Awaited<ReturnType<WalletSession['recover']>>) {
  if (namespaces.completed(result)) return;
  if (result.pending.kind === 'publish') {
    await downloads(result.pending.raw!, result.publication);
    signedRaw = null;
    status('Published. The successful receipt and ENS readback match. Allow two more blocks before verifying with the CLI or Action. Gas used: ' + result.receipt.gasUsed.toString() + '.', 'success');
  } else if (result.pending.kind === 'revoke') {
    revokeRequest = null; element('revoke-review').hidden = true;
    status('Withdrawn. The receipt and empty ENS record are confirmed. Rerun the CLI or GitHub Action after two more blocks.', 'withdrawn');
  } else if (result.pending.kind === 'deploy') {
    input('resolver-address').value = result.resolver!;
    status('Dedicated resolver created. Review and connect the ENS name in step 2. Gas used: ' + result.receipt.gasUsed.toString() + '.', 'success');
  } else if (result.pending.kind === 'bind') {
    input('publish-name').value = result.pending.name;
    status('The ENS name now points to your resolver. After two more blocks, prepare an endorsement in Publish.', 'success');
  } else status(result.pending.kind === 'grant' ? 'The endorsement key grant is confirmed.' : 'The endorsement key grant has been revoked. Existing endorsements remain published until withdrawn.',
    result.pending.kind === 'grant' ? 'success' : 'withdrawn');
}

document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(target => target.addEventListener('click', () => activate(target.dataset.tab!)));
document.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(target => target.addEventListener('click', () => {
  const tab = target.dataset.go!;
  activate(tab);
  document.querySelector<HTMLButtonElement>('[data-tab="' + tab + '"]')?.focus();
  element('panel-' + tab).scrollIntoView({ block: 'start' });
}));
for (const id of ['publish-name', 'subject-id', 'expires']) input(id).addEventListener('input', () => {
  if (!publishRequest) return;
  clearReview(); update();
  status('Details changed. Prepare the endorsement again, then review and sign the updated details.');
});
for (const id of ['consent', 'revoke-consent', 'bind-consent']) input(id).addEventListener('change', update);
button('connect').addEventListener('click', () => run('Connecting to your Sepolia wallet…', async () => {
  await wallet().connect(); status('Wallet connected. Your private key stays in your wallet.', 'success');
}));
element('prepare-form').addEventListener('submit', event => {
  event.preventDefault();
  void run('Reading your ENS publishing space…', async () => {
    clearReview();
    const current = await connected();
    const expiry = Math.floor(new Date(input('expires').value).getTime() / 1000);
    insist(Number.isFinite(expiry) && expiry > Date.now() / 1000, 'expired');
    const request = await makeRequest({ name: input('publish-name').value.trim(), issuer: current.account!,
      subject: 'github:' + input('subject-id').value.trim(), expiresAt: String(expiry) }, current.reader);
    review(request); status('Prepared locally. Review the contributor, purpose, expiry, and public record before signing.');
  });
});
input('request-file').addEventListener('change', () => run('Reading the unsigned request…', async () => {
  clearReview();
  review(validatePublishRequest(strictJson(await fileText('request-file'), 16384)));
  status('Request loaded. Its publishing location and current record will be rechecked before signing.');
}));
button('sign').addEventListener('click', () => run('Confirm the endorsement in your wallet…', async () => {
  insist(publishRequest && input('consent').checked, 'consent_required');
  signedRaw = await (await connected()).sign(publishRequest);
  element('signature-status').textContent = 'Signed. The endorsement is still unpublished. Publish it with a separate wallet transaction.';
  status('Signature checked. Publish to make this endorsement available on ENS.', 'success');
}));
button('publish').addEventListener('click', () => run('Rechecking the public record before sending…', async () => {
  insist(publishRequest && signedRaw && input('consent').checked, 'consent_required');
  await completed(await (await connected()).publish(publishRequest, signedRaw));
}));
element('fetch-form').addEventListener('submit', event => {
  event.preventDefault();
  void run('Retrieving the original public record and publication history…', async () => {
    downloadedRaw = null; downloadedPublication = null; element('downloads').hidden = true;
    const hint = input('publication-file').files?.length ? publicationHint(strictJson(await fileText('publication-file', 2048))) : undefined;
    const fetched = await new ChainReader(rpcUrl).fetch(input('fetch-name').value.trim(), hint);
    await downloads(fetched.raw, fetched.publication);
    status('Retrieved exact published bytes. Use the CLI or Action to evaluate current evidence against a repository policy.', 'success');
  });
});
input('revoke-file').addEventListener('change', () => run('Checking the exact endorsement to withdraw…', async () => {
  revokeRequest = null; element('revoke-review').hidden = true;
  const raw = await fileText('revoke-file'), value = strictJson(raw, 16384) as Record<string, unknown>;
  revokeRequest = value.operation === 'revoke' ? await validateRevokeRequest(value) : await makeRevoke(raw, new ChainReader(rpcUrl));
  const parsed = await parseCredential(revokeRequest.credential);
  details('revoke-details', [['Contributor', parsed.message.subject], ['Issuer', parsed.message.issuer],
    ['ENS name', parsed.message.recordName], ['Identifier', parsed.message.id]]);
  input('revoke-consent').checked = false; element('revoke-review').hidden = false;
  status('Withdrawal prepared, not sent. The exact current record will be checked again before submission.');
}));
button('revoke').addEventListener('click', () => run('Rechecking the target before withdrawal…', async () => {
  insist(revokeRequest && input('revoke-consent').checked, 'consent_required');
  await completed(await (await connected()).revoke(revokeRequest));
}));
button('deploy').addEventListener('click', () => run('Checking name ownership and preparing the official resolver deployment…', async () => {
  await completed(await (await connected()).deploy(input('setup-name').value.trim()));
}));
button('bind').addEventListener('click', () => run('Checking ownership and resolver permissions…', async () => {
  insist(input('bind-consent').checked, 'consent_required');
  await completed(await (await connected()).bind(input('setup-name').value.trim(), address(input('resolver-address').value.trim())));
}));
for (const id of ['grant', 'remove']) button(id).addEventListener('click', () => run('Preparing the endorsement key permission change…', async () => {
  await completed(await (await connected()).helper(input('setup-name').value.trim(), address(input('helper-address').value.trim()), id === 'grant'));
}));
button('recover').addEventListener('click', () => run('Checking the saved transaction against its receipt and ENS readback…', async () => {
  await completed(await wallet().recover(input('recovery-hash').value.trim() as Hex));
}));
button('download-recovery').addEventListener('click', () => {
  if (submission.pending) download('devouch-recovery.json', JSON.stringify(submission.pending, null, 2) + '\n');
});
input('recovery-file').addEventListener('change', () => run('Loading the saved public operation…', async () => {
  insist(!submission.pending, 'pending_transaction');
  const pending = validatePending(strictJson(await fileText('recovery-file', 32768), 32768));
  localStorage.setItem(storageKey, JSON.stringify(pending));
  submission.pending = pending; damagedRecovery = false;
  status('Recovery file loaded. Check the transaction before sending another operation.');
}));
button('download-vouch').addEventListener('click', () => run('Preparing the original endorsement file…', async () => {
  const parsed = await parseCredential(downloadedRaw!);
  download('github-' + parsed.message.subject.split(':')[1] + '.json', downloadedRaw!);
  status('Downloaded the exact published bytes. Include this file in the contributor’s PR.', 'success');
}));
button('download-publication').addEventListener('click', () => {
  if (downloadedPublication) download('publication.json', JSON.stringify(downloadedPublication, null, 2) + '\n');
});
button('download-policy').addEventListener('click', () => run('Preparing a repository policy example…', async () => {
  const parsed = await parseCredential(downloadedRaw!);
  const repository = input('repository-id').value.trim();
  insist(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository));
  download('policy.json', JSON.stringify({ repositoryId: repository, chainId: 11155111,
    trustedIssuers: [parsed.message.issuer], allowedScopes: [parsed.message.scope],
    allowedResolvers: [{ address: parsed.message.resolver, implementation: RESOLVER_IMPL }], requiredIssuers: 1 }, null, 2) + '\n');
  status('Policy example downloaded. The receiving maintainer must independently approve this issuer.', 'success');
}));
button('apply-rpc').addEventListener('click', () => run('Changing the read connection…', async () => {
  const selected = input('rpc-url').value.trim();
  await new ChainReader(selected).snapshot();
  rpcUrl = selected; session = null; signedRaw = null;
  verification.invalidate();
  maintainers?.invalidate();
  status('Sepolia connection checked. Reconnect the wallet before writing. Pending recovery data has been preserved.', 'success');
}));
window.ethereum?.on?.('accountsChanged', () => { session = null; signedRaw = null; update(); status('Wallet changed. Reconnect and review the operation again.'); });
window.ethereum?.on?.('chainChanged', () => { session = null; signedRaw = null; update(); });
const nextWeek = new Date(Date.now() + 7 * 86400000);
input('expires').value = localDateTime(nextWeek).slice(0, 16);
const namespaces = initializeNamespaces({ rpc: () => rpcUrl, connected, run, status, complete: completed, details, update,
  publish(name) { clearReview(); input('publish-name').value = name; activate('publish'); update(); } });
maintainers = initializeMaintainers({ rpc: () => rpcUrl, busy: () => busy, run, status, download });
update();
if (['#verify', '#namespaces', '#maintainers'].includes(location.hash)) activate(location.hash.slice(1));
const verification = initializeVerification(() => rpcUrl);
