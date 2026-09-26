// ABOUTME: Runs explicit read-only connection and historical-data probes for Sepolia.
// ABOUTME: Reports partial failures without switching providers or implying endorsement acceptance.
import { ChainReader, type Snapshot } from './chain';
import { DEPLOYMENT_BLOCK, DEPLOYMENTS, FACTORY, implementationMatches } from './ens';
import { insist } from './errors';
import { diagnosticReason } from './rpc-errors';

type Probe = { snapshot(): Promise<Snapshot>; historicalState(): Promise<void>; historicalLogs(): Promise<void> };
export type DiagnosticCheck = { name: 'snapshot' | 'historical_state' | 'historical_logs';
  status: 'passed' | 'failed' | 'not_checked'; reason?: string };

export function connectionProbe(rpcUrl: string): Probe {
  const reader = new ChainReader(rpcUrl);
  return {
    snapshot: () => reader.snapshot(),
    async historicalState() {
      const code = await reader.client.getCode({ address: FACTORY, blockNumber: DEPLOYMENT_BLOCK });
      insist(implementationMatches(code, DEPLOYMENTS.factory), 'historical_code_mismatch', 'unavailable');
    },
    async historicalLogs() {
      await reader.client.getLogs({ address: FACTORY, fromBlock: DEPLOYMENT_BLOCK, toBlock: DEPLOYMENT_BLOCK });
    },
  };
}

export async function diagnoseConnection(probe: Probe) {
  let snapshot: Snapshot | undefined;
  const checks: DiagnosticCheck[] = [
    { name: 'snapshot', status: 'not_checked' },
    { name: 'historical_state', status: 'not_checked' },
    { name: 'historical_logs', status: 'not_checked' },
  ];
  const tasks = [async () => { snapshot = await probe.snapshot(); }, () => probe.historicalState(), () => probe.historicalLogs()];
  for (let index = 0; index < tasks.length; index++) {
    const check = checks[index]!;
    try { await tasks[index]!(); check.status = 'passed'; }
    catch (error) {
      check.status = 'failed'; check.reason = diagnosticReason(error);
      if (index === 0 || check.reason === 'rate_limited') break;
    }
  }
  return { checks, snapshot };
}
