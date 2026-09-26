// ABOUTME: Presents explicit connection diagnostics and optional complete name verification.
// ABOUTME: Keeps candidate RPC tests separate from applying a connection and never stores provider URLs.
import { ChainReader } from '../src/chain';
import { DEPLOYMENT_BLOCK } from '../src/ens';
import { connectionProbe, diagnoseConnection } from '../src/rpc-diagnostics';
import { diagnosticReason } from '../src/rpc-errors';
import { EvidenceError } from '../src/errors';

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const field = (id: string) => element<HTMLInputElement>(id);
const advice: Record<string, string> = {
  rate_limited: 'The provider is limiting requests. Wait before retrying, or explicitly select another connection.',
  provider_limit: 'The provider reported a request or query limit. Review its history limits, then retry or explicitly select another connection.',
  history_unavailable: 'This provider could not serve historical state. Choose one with archive state and historical logs.',
  historical_code_mismatch: 'The expected ENS factory bytecode was not returned at the sample historical block.',
  timeout: 'The request timed out. Retry later or explicitly select another connection.',
  connection_failed: 'The request failed. Check the URL, network, browser access, and provider availability.',
  chain_mismatch: 'This connection is not Sepolia (chain 11155111).',
  stale_snapshot: 'The provider returned an old or inconsistent block timestamp.',
  invalid_rpc_url: 'Use HTTPS, or HTTP on localhost for a local test chain.',
};

export function initializeRpcDiagnostics(context: { rpc(): string; run(message: string, work: () => Promise<void>): Promise<void>;
  status(message: string): void }) {
  const result = element('rpc-diagnostics');
  function line(label: string, value: string) {
    const row = document.createElement('p');
    const title = document.createElement('strong'); title.textContent = label + ': ';
    row.append(title, document.createTextNode(value)); result.append(row); return row;
  }
  function active() {
    const url = new URL(context.rpc());
    element('rpc-active').textContent = 'Active connection: ' + url.hostname + (url.port ? ':' + url.port : '');
  }
  function invalidate() { result.replaceChildren(); result.hidden = true; active(); }
  field('rpc-url').addEventListener('input', invalidate);
  field('rpc-check-name').addEventListener('input', invalidate);
  element('rpc-alternative').addEventListener('click', () => {
    field('rpc-url').value = 'https://rpc.sepolia.ethpandaops.io'; invalidate();
    element('rpc-selection-note').textContent = 'Alternative filled in. Diagnose it, then choose Use this connection to apply it.';
  });
  element('diagnose-rpc').addEventListener('click', () => void context.run('Checking the selected RPC without changing your active connection…', async () => {
    result.replaceChildren(); result.hidden = false;
    line('Connection', 'Checking…');
    const candidate = field('rpc-url').value.trim();
    try {
      const report = await diagnoseConnection(connectionProbe(candidate));
      result.replaceChildren();
      const labels = { snapshot: 'Sepolia & fresh snapshot', historical_state: 'Historical contract state', historical_logs: 'Historical event logs' };
      for (const check of report.checks) {
        line(labels[check.name], check.status + (check.reason ? ' — ' + check.reason : ''));
        if (check.reason && advice[check.reason]) line('Next step', advice[check.reason]!);
      }
      if (report.snapshot) line('Snapshot', `${report.snapshot.block_number} · ${report.snapshot.checked_at}`);
      line('Historical sample', `ENS factory at block ${DEPLOYMENT_BLOCK}. This samples one block; it does not guarantee all history is available.`);
      const name = field('rpc-check-name').value.trim();
      if (name && report.checks.every(check => check.status === 'passed')) {
        const progress = line('Full endorsement check', 'Checking signature, ENS history, and snapshot for ' + name + '…');
        try {
          const verified = await new ChainReader(candidate).verifyName(name);
          progress.textContent = 'Full endorsement check: completed for ' + name;
          line('Evidence', verified.evidence.evidence_status);
          line('Evidence snapshot', `${verified.snapshot.block_number} · ${verified.snapshot.checked_at}`);
          if (verified.evidence.reason_codes.length) line('Reason', verified.evidence.reason_codes.join(', '));
        } catch (error) {
          progress.textContent = 'Full endorsement check: could not complete for ' + name;
          line('Evidence', error instanceof EvidenceError ? error.status : 'unavailable');
          const reason = diagnosticReason(error); line('Reason', reason);
          if (advice[reason]) line('Next step', advice[reason]!);
        }
      } else line('Full endorsement check', 'not_checked — enter an optional publication name after the connection probes pass.');
      line('Policy', 'not_evaluated. Connection diagnostics do not establish repository acceptance.');
    } catch (error) {
      result.replaceChildren(); const reason = error instanceof TypeError ? 'invalid_rpc_url' : diagnosticReason(error);
      line('Connection', 'failed — ' + reason);
      line('Next step', advice[reason] ?? 'Check the connection and try again.');
    }
    line('Active connection', 'Unchanged. Choose Use this connection to apply the selected URL.');
    line('human verification', 'not included');
    context.status('RPC diagnostics finished. Review the individual checks in Connection settings.');
  }));
  active();
  return { invalidate };
}
