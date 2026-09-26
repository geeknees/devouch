// ABOUTME: Visualizes one checked endorsement and its independent repository decisions.
// ABOUTME: Reuses verification results without discovering extra relationships or making network requests.
import type { Snapshot } from '../src/chain';
import type { Message } from '../src/credential';
import type { IssuerIdentity } from '../src/identity';
import type { PolicyDecision, PolicyEvidence, RepositoryPolicy } from '../src/policy';

export type TrustMapPolicy = {
  id: string; title: string; policy: RepositoryPolicy | null; decision: PolicyDecision;
  editTarget?: string; source?: { url: string; baseSha: string; digest: string };
};
export type TrustMapReport = {
  message: Message; evidence: PolicyEvidence & { snapshot?: Snapshot | null };
  identity?: IssuerIdentity; policies: TrustMapPolicy[];
  author?: { subject: string; login: string };
};
type Node = {
  id: string; label: string; title: string; note: string; badge: string; state: string;
  description: string; fields: [string, string][];
  action?: { label: string; target?: string; href?: string };
};
const html = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};
const shortAddress = (value: string) => value.slice(0, 6) + '…' + value.slice(-4);
const instant = (seconds: string) => {
  const date = new Date(Number(seconds) * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : seconds + ' (Unix seconds)';
};

function nodesFor(report: TrustMapReport): Node[] {
  const { message: m, evidence: proof, identity } = report, snapshot = proof.snapshot;
  const name = identity?.name;
  const nodes: Node[] = [{
    id: 'issuer', label: 'Recommender', title: name ?? shortAddress(m.issuer),
    note: name ? shortAddress(m.issuer) : 'Issuer address', badge: 'Signature valid', state: 'valid',
    description: 'This address signed the endorsement. Each repository chooses whether to trust it.',
    fields: [['Issuer address', m.issuer], ['Primary ENS name', name ?? (identity?.status === 'not_set' ? 'Not set'
      : identity?.status === 'unavailable' ? 'Lookup unavailable' : 'Not resolved')],
      ['Name relationship', name ? name === m.recordName ? 'Primary ENS name matches the publication name.'
        : 'Primary ENS name differs from the publication name.' : 'The publication name is a separate signed field.']],
  }, {
    id: 'publication', label: 'ENS publication', title: m.recordName, note: 'devouch.vouch',
    badge: snapshot ? 'Block ' + snapshot.block_number : 'Not checked', state: 'reference',
    description: 'The signed publication location. The evidence result includes ENS history, binding, withdrawal, and expiry checks.',
    fields: [['Publication name', m.recordName], ['Resolver', m.resolver], ['Record ID', m.recordId],
      ['Sepolia block', snapshot?.block_number ?? 'Not checked'], ['Checked (UTC)', snapshot?.checked_at ?? 'Not checked'],
      ['Block hash', snapshot?.block_hash ?? 'Not checked']],
  }, {
    id: 'endorsement', label: 'Signed subject', title: m.subject, note: m.scope,
    badge: proof.evidence_status, state: proof.evidence_status,
    description: 'One signed recommendation, checked once. Repository decisions below use this same evidence.',
    fields: [['Evidence', proof.evidence_status], ['Reason codes', proof.reason_codes.join(', ') || 'None'],
      ['Signed subject', m.subject], ['Scope', m.scope], ['Expires (UTC)', instant(m.expiresAt)]],
  }];
  if (report.author) nodes[2]!.fields.push(['PR author', '@' + report.author.login], ['Expected subject', report.author.subject],
    ['Subject match', m.subject === report.author.subject ? 'Matches PR author' : 'Does not match PR author']);
  for (const entry of report.policies) {
    const { policy, decision, source } = entry;
    const trust = policy ? policy.trustedIssuers.some(address => address.toLowerCase() === m.issuer.toLowerCase())
      ? 'Issuer is listed' : 'Issuer is not listed' : 'Policy is invalid';
    const fields: [string, string][] = [
      ['Policy source', source ? 'Base-commit policy' : 'Editable example in this browser'],
      ['Decision', decision.policy_status], ['Reason codes', decision.reason_codes.join(', ') || 'None'],
      ['Trust in this issuer', trust],
    ];
    if (policy) fields.push(['Trusted issuers', policy.trustedIssuers.join('\n') || 'None'],
      ['Allowed scopes', policy.allowedScopes.join(', ') || 'None'],
      ['Allowed resolvers', policy.allowedResolvers.map(value => value.address + ' / implementation ' + value.implementation).join('\n') || 'None']);
    if (source) fields.push(['Base SHA', source.baseSha], ['Policy digest', source.digest]);
    nodes.push({ id: entry.id, label: source ? 'Repository policy' : 'Example policy', title: entry.title,
      note: trust, badge: decision.policy_status, state: decision.policy_status,
      description: decision.policy_status === 'accepted' ? 'Valid evidence meets this repository’s issuer, scope, and resolver rules.'
        : decision.policy_status === 'rejected' ? 'The evidence is valid. This repository’s rules reject it for the reasons below.'
          : 'No acceptance decision was made. Check the evidence and policy reason codes below.',
      fields, action: source ? { label: 'View committed policy', href: source.url }
        : entry.editTarget ? { label: 'Edit trusted issuers', target: entry.editTarget } : undefined });
  }
  return nodes;
}

export function initializeTrustMap(root: HTMLElement) {
  root.classList.add('trust-map'); root.hidden = true;
  root.setAttribute('aria-label', 'Trust map');
  const heading = html('div', 'trust-map-heading'), headingText = html('div', '');
  headingText.append(html('span', 'eyebrow', 'TRACE THE RECOMMENDATION'), html('h4', '', 'Trust has a path.'));
  const stamp = html('p', 'trust-map-stamp'); heading.append(headingText, stamp);
  const caption = html('p', 'field-note', 'Select a node to inspect its evidence or policy. Each repository decides independently.');
  const stage = html('div', 'trust-map-stage');
  const lines = svg('svg', { class: 'trust-map-lines', 'aria-hidden': 'true', focusable: 'false' });
  const sources = html('div', 'trust-map-sources'), subject = html('div', 'trust-map-subject'), policies = html('div', 'trust-map-policies');
  stage.setAttribute('role', 'group'); stage.setAttribute('aria-label', 'Recommendation and repository decisions');
  stage.append(lines, sources, subject, policies);
  const inspector = html('details', 'trust-map-inspector');
  inspector.append(html('summary', '', 'Inspect connection details'));
  const detail = html('div', 'trust-map-details'); detail.id = root.id + '-details';
  detail.setAttribute('role', 'region'); detail.setAttribute('aria-label', 'Selected connection details');
  detail.setAttribute('aria-live', 'polite');
  const detailTitle = html('h5', ''), description = html('p', 'field-note'), fields = html('dl', 'details');
  const actionSlot = html('div', 'trust-map-action'); detail.append(detailTitle, description, fields, actionSlot);
  inspector.append(detail);
  const boundary = html('p', 'trust-map-boundary', 'One endorsement at the checked block. The map shows only this verification; trust is not inherited through other issuers.');
  root.append(heading, caption, stage, inspector, boundary);
  let nodes: Node[] = [], selected = 'endorsement', frame = 0, actionKey = '', hasSnapshot = false;
  const buttons = new Map<string, HTMLButtonElement>();
  const edges = new Map<string, { path: SVGPathElement; label: SVGTextElement }>();

  function select(id: string, open = true) {
    selected = id;
    if (open) inspector.open = true;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id));
    const node = nodes.find(value => value.id === id);
    if (!node) return;
    detailTitle.textContent = node.label + ' · ' + node.title;
    description.textContent = node.description;
    fields.replaceChildren(...node.fields.flatMap(([key, value]) => [html('dt', '', key), html('dd', '', value)]));
    const nextAction = JSON.stringify(node.action ?? null);
    if (nextAction !== actionKey) {
      actionKey = nextAction; actionSlot.replaceChildren();
      if (node.action?.target) {
        const targetId = node.action.target, action = html('button', 'text-button', node.action.label);
        action.type = 'button';
        action.addEventListener('click', () => document.getElementById(targetId)?.focus()); actionSlot.append(action);
      } else if (node.action?.href) {
        const action = html('a', '', node.action.label);
        action.href = node.action.href; action.target = '_blank'; action.rel = 'noreferrer'; actionSlot.append(action);
      }
    }
    for (const [key, edge] of edges) {
      const active = id === 'endorsement' || key === id || (key === 'signature' && id === 'issuer')
        || (id.startsWith('policy-') && ['signature', 'publication'].includes(key));
      edge.path.dataset.active = String(active);
    }
  }

  function draw() {
    frame = 0;
    const bounds = stage.getBoundingClientRect();
    if (root.hidden || !bounds.width || !bounds.height) return;
    lines.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const connections = [
      { id: 'signature', from: 'issuer', to: 'endorsement', label: 'signed', state: 'valid', port: .5 },
      { id: 'publication', from: 'publication', to: 'endorsement', label: hasSnapshot ? 'history' : 'not checked', state: 'reference', port: .5 },
      ...nodes.filter(node => node.id.startsWith('policy-')).map(node => ({ id: node.id, from: 'endorsement', to: node.id,
        label: 'policy', state: node.state, port: .5 })),
    ];
    for (const connection of connections) {
      const from = buttons.get(connection.from)?.getBoundingClientRect(), to = buttons.get(connection.to)?.getBoundingClientRect();
      if (!from || !to) continue;
      let edge = edges.get(connection.id);
      if (!edge) {
        const path = svg('path', { class: 'trust-map-edge', fill: 'none', 'data-trust-edge': connection.id });
        const label = svg('text', { class: 'trust-map-edge-label', 'text-anchor': 'middle' });
        edge = { path, label }; edges.set(connection.id, edge); lines.append(path, label);
      }
      const x1 = from.left + from.width / 2 - bounds.left, y1 = from.bottom - bounds.top;
      const x2 = to.left + to.width * connection.port - bounds.left, y2 = to.top - bounds.top;
      const mid = (y1 + y2) / 2;
      edge.path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`);
      edge.path.dataset.state = connection.state;
      edge.label.setAttribute('x', String((x1 + x2) / 2)); edge.label.setAttribute('y', String(mid + 4));
      edge.label.textContent = connection.label;
    }
    // Resize only changes decorative paths, so it never replaces a focused control or live details.
    for (const [key, edge] of edges) edge.path.dataset.active = String(selected === 'endorsement' || key === selected
      || (key === 'signature' && selected === 'issuer') || (selected.startsWith('policy-') && ['signature', 'publication'].includes(key)));
  }
  function scheduleDraw() { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); }
  const observer = new ResizeObserver(scheduleDraw); observer.observe(stage);

  function clear() {
    root.hidden = true; nodes = []; selected = 'endorsement'; inspector.open = false; cancelAnimationFrame(frame);
  }
  function update(report: TrustMapReport) {
    nodes = nodesFor(report); root.hidden = false;
    hasSnapshot = Boolean(report.evidence.snapshot);
    stamp.textContent = report.evidence.snapshot ? 'SEPOLIA / ' + report.evidence.snapshot.block_number : 'SNAPSHOT / NOT CHECKED';
    for (const node of nodes) {
      let button = buttons.get(node.id);
      if (!button) {
        button = html('button', 'trust-map-node'); button.type = 'button'; button.dataset.trustNode = node.id;
        button.setAttribute('aria-controls', detail.id);
        button.append(html('span', 'trust-map-node-label'), html('strong', 'trust-map-node-title'),
          html('span', 'trust-map-node-note'), html('span', 'trust-map-node-badge'));
        button.addEventListener('click', () => select(node.id)); buttons.set(node.id, button);
        (node.id === 'endorsement' ? subject : node.id.startsWith('policy-') ? policies : sources).append(button);
        observer.observe(button);
      }
      button.dataset.state = node.state;
      button.querySelector('.trust-map-node-label')!.textContent = node.label;
      button.querySelector('.trust-map-node-title')!.textContent = node.title;
      button.querySelector('.trust-map-node-note')!.textContent = node.note;
      button.querySelector('.trust-map-node-badge')!.textContent = node.badge;
    }
    select(selected, false); scheduleDraw();
  }
  return { update, clear };
}
