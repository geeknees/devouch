// ABOUTME: Guides issuer-owned subname creation and narrowly scoped agent profile permissions.
// ABOUTME: Saves public setup progress and relies on receipt recovery before advancing wallet operations.
import { zeroAddress } from 'viem';
import { ChainReader } from '../src/chain';
import { address, strictJson } from '../src/credential';
import { EvidenceError, insist } from '../src/errors';
import type { WalletSession } from './wallet';

type Result = Awaited<ReturnType<WalletSession['recover']>>;
type Hooks = {
  rpc: () => string;
  connected: () => Promise<WalletSession>;
  run: (message: string, work: () => Promise<void>) => Promise<void>;
  status: (message: string, tone?: 'neutral' | 'success' | 'error' | 'withdrawn') => void;
  complete: (result: Result) => Promise<void>;
  details: (id: string, fields: [string, string][]) => void;
  publish: (name: string) => void;
  update: () => void;
};
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const target = (id: string) => document.getElementById(id)!;
const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
const savedFields = ['namespace-parent', 'namespace-label', 'namespace-registry', 'namespace-expires',
  'namespace-record-name', 'namespace-resolver', 'namespace-agent-subject', 'namespace-agent-wallet'];
const storageKey = 'devouch.namespace.v1';

export function initializeNamespaces(hooks: Hooks) {
  const save = () => localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(savedFields.map(id => [id, field(id).value]))));
  const dateInput = (seconds: bigint) => {
    const date = new Date(Number(seconds) * 1000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  field('namespace-expires').value = dateInput(BigInt(Math.floor(Date.now() / 1000)) + 7n * 86400n);
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = strictJson(raw, 8192) as Record<string, unknown>;
      for (const id of savedFields) if (typeof saved[id] === 'string' && saved[id].length <= 512) field(id).value = saved[id];
    }
  } catch { hooks.status('Saved namespace setup could not be read. Re-enter the public names and addresses. Pending transaction recovery remains available.'); }
  const preview = () => {
    const parent = field('namespace-parent').value.trim(), label = field('namespace-label').value.trim();
    target('namespace-preview').textContent = label && parent ? `${label}.${parent}` : 'Enter a parent name and one label.';
  };
  for (const id of savedFields) field(id).addEventListener('input', () => {
    if (id === 'namespace-parent') field('namespace-registry').value = '';
    if (id === 'namespace-record-name' || id === 'namespace-resolver') field('namespace-record-consent').checked = false;
    save(); preview(); hooks.update();
  });
  field('namespace-agent-mode').addEventListener('change', () => { target('namespace-agent-fields').hidden = !field('namespace-agent-mode').checked; });
  field('namespace-record-consent').addEventListener('change', hooks.update);
  const on = (id: string, message: string, work: () => Promise<void>) => button(id).addEventListener('click', () => void hooks.run(message, work));
  const write = (id: string, message: string, work: (session: WalletSession) => Promise<Result>) =>
    on(id, message, async () => { save(); await hooks.complete(await work(await hooks.connected())); });
  const parent = () => field('namespace-parent').value.trim();
  const registry = () => address(field('namespace-registry').value.trim());
  const record = () => field('namespace-record-name').value.trim();
  on('namespace-inspect', 'Reading the parent name and its hierarchy…', async () => {
    const found = await new ChainReader(hooks.rpc()).inspectName(parent(), { latest: true });
    const current = found.path.at(-1)!.subregistry;
    if (current !== zeroAddress) field('namespace-registry').value = current;
    const proposed = BigInt(Math.floor(Date.now() / 1000)) + 7n * 86400n;
    field('namespace-expires').value = dateInput(found.expiry < proposed ? found.expiry : proposed);
    hooks.details('namespace-parent-details', [['Parent', parent()], ['Owner', found.state.latestOwner],
      ['Child registry', current === zeroAddress ? 'Not connected yet' : current],
      ['Hierarchy', found.path.map(hop => hop.name).join(' → ')], ['Checked block', found.snapshot.block_number]]);
    save(); hooks.status('Parent checked. Create a child registry only if none is connected. Each following button requests one wallet transaction.', 'success');
  });
  write('namespace-deploy', 'Creating your child registry…', session => session.deployRegistry(parent()));
  write('namespace-parent-link', 'Setting the registry’s parent link…', session => session.parentRegistry(parent(), registry()));
  write('namespace-connect', 'Connecting the child registry to its parent name…', session => session.bindRegistry(parent(), registry()));
  write('namespace-register', 'Registering an issuer-owned subname…', session => {
    const expiry = Math.floor(new Date(field('namespace-expires').value).getTime() / 1000);
    insist(Number.isSafeInteger(expiry) && expiry > Date.now() / 1000, 'invalid_expiry');
    return session.registerName(parent(), field('namespace-label').value.trim(), String(expiry));
  });
  button('namespace-use-parent').addEventListener('click', () => {
    field('namespace-parent').value = record(); field('namespace-label').value = ''; field('namespace-registry').value = '';
    target('namespace-parent-details').replaceChildren(); save(); preview();
    hooks.status('Use this subname as the next parent. Create its child registry, then register a contributor ID or agent label.');
  });
  const agentIdentity = () => {
    if (!field('namespace-agent-mode').checked) return undefined;
    const id = field('namespace-agent-subject').value.trim();
    insist(/^[1-9][0-9]{0,19}$/.test(id), 'invalid_agent_subject');
    let wallet;
    try { wallet = address(field('namespace-agent-wallet').value.trim()); }
    catch { throw new EvidenceError('invalid_agent_wallet'); }
    return { subject: 'github:' + id, wallet };
  };
  write('namespace-record-deploy', 'Creating an independent resolver for this subname…', session => session.deploy(record(), agentIdentity()));
  write('namespace-record-bind', 'Connecting the subname to its publishing record…', session => {
    insist(field('namespace-record-consent').checked, 'consent_required');
    return session.bind(record(), address(field('namespace-resolver').value.trim()));
  });
  button('namespace-open-publish').addEventListener('click', () => hooks.publish(record()));

  const readAgent = async () => {
    const name = field('agent-name').value.trim();
    const found = await new ChainReader(hooks.rpc()).readAgent(name);
    const identity = found.identity;
    field('agent-wallet').value = identity.wallet;
    hooks.details('agent-details', [['ENS name', identity.name], ['GitHub subject (controller declared)', identity.subject],
      ['Agent wallet', identity.wallet], ['Controller', identity.controller], ['Resolver', found.resolver],
      ['Granted fields', Object.entries(found.permissions).filter(([, granted]) => granted).map(([key]) => key).join(', ') || 'None'],
      ...Object.entries(found.profile).map(([key, value]) => [key, value || '(empty)'] as [string, string]),
      ['Checked block', found.snapshot.block_number]]);
    target('agent-result').hidden = false;
    const url = new URL(location.href); url.search = ''; url.searchParams.set('agent', name); url.hash = 'namespaces';
    field('agent-share-url').value = url.toString();
    hooks.status('Agent identity and current profile permissions checked. This identity is declared by its controller; it is not proof of account ownership or human identity.', 'success');
  };
  on('agent-inspect', 'Reading the agent identity and its current permissions…', readAgent);
  for (const [id, grant] of [['agent-grant', true], ['agent-remove', false]] as const) {
    write(id, 'Preparing the profile permission change…', session => session.agentPermission(field('agent-name').value.trim(),
      address(field('agent-wallet').value.trim()), field('agent-key').value, grant));
  }
  write('agent-update', 'Checking the connected wallet’s permission to edit this profile field…', session =>
    session.updateAgentProfile(field('agent-name').value.trim(), field('agent-key').value, field('agent-value').value));

  preview();
  const agentName = new URLSearchParams(location.search).get('agent');
  if (agentName && agentName.length <= 255) field('agent-name').value = agentName;
  return {
    completed(result: Result): boolean {
      const pending = result.pending;
      if (pending.kind === 'deploy-registry') {
        field('namespace-parent').value = pending.name; field('namespace-registry').value = result.registry!;
        hooks.status('Child registry created. Set its parent link, then connect it to the name.', 'success');
      } else if (pending.kind === 'parent-registry') hooks.status('Parent link confirmed. Connect this registry to the parent name.', 'success');
      else if (pending.kind === 'bind-registry') hooks.status('Child registry connected. Register a subname below it.', 'success');
      else if (pending.kind === 'register-name') {
        field('namespace-record-name').value = pending.name; field('namespace-resolver').value = '';
        field('namespace-record-consent').checked = false;
        hooks.status('Subname registered. Use it as a parent for more names, or create its independent publishing record.', 'success');
      } else if (pending.kind === 'deploy' && pending.name === record()) {
        field('namespace-resolver').value = result.resolver!;
        hooks.status('Dedicated resolver created. Review and connect it to this subname.', 'success');
      } else if (pending.kind === 'bind' && pending.name === record()) {
        field('agent-name').value = pending.name;
        hooks.status('Publishing record connected. Wait two blocks, then publish an endorsement or inspect the agent identity.', 'success');
      } else if (pending.kind === 'grant-profile' || pending.kind === 'remove-profile') {
        hooks.status(pending.kind === 'grant-profile' ? 'Profile permission granted. Inspect again after two blocks to refresh.'
          : 'Profile permission revoked. Inspect again after two blocks to refresh.', pending.kind === 'grant-profile' ? 'success' : 'withdrawn');
      } else if (pending.kind === 'profile') hooks.status('Profile updated and read back from ENS. Inspect again after two blocks to refresh.', 'success');
      else return false;
      save(); preview(); return true;
    },
  };
}
