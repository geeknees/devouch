// ABOUTME: Runs the ERC-8004 reader and unsigned registry operations for the Ruby CLI.
// ABOUTME: Uses bounded JSON over stdin and never sends transactions or exposes provider diagnostics.
import { Erc8004Reader, parseFeedbackReference } from './erc8004';
import { DEFAULT_DEPLOYMENT, parseDeployment } from './erc8004-deployment';
import { prepareTransaction } from './erc8004-operations';
import { address, object, strictJson, subject } from './json';
import { EvidenceError, insist } from './errors';

export async function execute(input: Record<string, unknown>) {
  try {
    const command = input.command;
    insist(['verify', 'register', 'map', 'request', 'fetch', 'revoke'].includes(String(command)), 'invalid_command');
    insist(typeof input.rpc_url === 'string', 'invalid_rpc_url');
    const url = new URL(input.rpc_url); insist(['http:', 'https:'].includes(url.protocol), 'invalid_rpc_url');
    const reader = new Erc8004Reader(input.rpc_url);
    if (command === 'verify') {
      insist(typeof input.raw === 'string');
      const reference = parseFeedbackReference(input.raw), target = subject(input.subject);
      const evidence = await reader.inspect(reference, target);
      const s = evidence.snapshot;
      return { ...evidence, subject: target, snapshot: s ? { chain_id: reference.chainId,
        block_number: s.blockNumber, block_hash: s.blockHash, block_timestamp: s.timestamp,
        checked_at: new Date().toISOString() } : null };
    }
    const deployment = input.deployment === undefined ? DEFAULT_DEPLOYMENT : parseDeployment(JSON.stringify(input.deployment));
    if (command === 'fetch') {
      const reference = parseFeedbackReference(JSON.stringify({ format: 'devouch-erc8004-v1', chainId: deployment.chainId,
        identityRegistry: deployment.registry.identityRegistry, reputationRegistry: deployment.registry.reputationRegistry,
        agentId: input.agent_id, clientAddress: input.issuer, feedbackIndex: input.feedback_index, feedbackBlock: input.feedback_block }));
      return await reader.fetch(reference);
    }
    if (command === 'revoke') {
      insist(typeof input.raw === 'string');
      const reference = parseFeedbackReference(input.raw);
      return { request: await prepareTransaction(reader, deployment, { operation: 'revoke', from: reference.clientAddress, reference }) };
    }
    const operation = command === 'request' ? 'feedback' : command === 'map' ? 'map' : 'register';
    return { request: await prepareTransaction(reader, deployment, { operation,
      from: address(operation === 'feedback' ? input.issuer : input.owner),
      agentId: typeof input.agent_id === 'string' ? input.agent_id : undefined,
      subject: typeof input.subject === 'string' ? input.subject : undefined,
      expiresAt: typeof input.expires_at === 'string' ? input.expires_at : undefined }) };
  } catch (error) {
    const failure = error instanceof EvidenceError ? error : new EvidenceError('evidence_unavailable', 'unavailable');
    if (input.command === 'verify') return { evidence_status: failure.status, reason_codes: [failure.code], snapshot: null,
      subject: typeof input.subject === 'string' ? input.subject : null, human_verification: 'not_included' };
    return { error: { code: failure.code, message: failure.code.replaceAll('_', ' ') }, exit_status: failure.status === 'unavailable' ? 3 : 2 };
  }
}

async function main() {
  try {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of process.stdin) { size += chunk.length; insist(size <= 65_536); chunks.push(chunk); }
    const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
    process.stdout.write(JSON.stringify(await execute(object(strictJson(raw, 65_536)))) + '\n');
  } catch {
    process.stdout.write(JSON.stringify({ error: { code: 'invalid_bridge_input', message: 'Invalid verifier request.' }, exit_status: 4 }) + '\n');
  }
}
if (process.argv[1]?.endsWith('/bridge.mjs') || process.argv[1]?.endsWith('/bridge.ts')) await main();
