// ABOUTME: Replays a mined wallet transaction against its parent block without signing or broadcasting.
// ABOUTME: Preserves EIP-7702 authorizations and reports gas results without publishing account or calldata details.
import { toHex } from 'viem';

type RpcMethod = 'eth_getTransactionByHash' | 'debug_traceCall';
type Trace = { error?: string; gas?: string; gasUsed?: string; input?: string; calls?: Trace[] };
function quantity(value: unknown) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{1,16}(?![\s\S])/.test(value)) throw new Error('invalid RPC quantity');
  const n = BigInt(value);
  if (n > 2n ** 64n - 1n) throw new Error('RPC quantity out of range');
  return n;
}

export function replayInput(tx: Record<string, unknown>, gas: bigint) {
  const blockNumber = quantity(tx.blockNumber);
  if (blockNumber === 0n || gas <= 0n || gas >= 2n ** 64n) throw new Error('invalid replay context');
  if (tx.type === '0x4' && (!Array.isArray(tx.authorizationList) || tx.authorizationList.length === 0))
    throw new Error('invalid type-4 authorization context');
  const call: Record<string, unknown> = { from: tx.from, to: tx.to, data: tx.input, value: tx.value, gas: toHex(gas) };
  for (const key of ['nonce', 'type', 'chainId', 'authorizationList']) {
    if (tx[key] !== undefined && tx[key] !== null) call[key] = tx[key];
  }
  const feeKeys = tx.maxFeePerGas != null ? ['maxFeePerGas', 'maxPriorityFeePerGas'] : ['gasPrice'];
  for (const key of feeKeys) if (tx[key] !== undefined && tx[key] !== null) call[key] = tx[key];
  return { call, block: toHex(blockNumber - 1n) };
}

async function main() {
  const [rpcUrl, hash, ...values] = process.argv.slice(2);
  if (!rpcUrl || !hash || !/^0x[0-9a-fA-F]{64}(?![\s\S])/.test(hash) || values.length > 4
    || values.some(v => !/^[1-9][0-9]{0,15}(?![\s\S])/.test(v))) {
    throw new Error('Usage: bun scripts/replay-wallet-gas.ts RPC_URL MINED_TX_HASH [GAS_LIMIT ...]');
  }
  if (!['http:', 'https:'].includes(new URL(rpcUrl).protocol)) throw new Error('HTTP RPC required');
  const rpc = async (method: RpcMethod, params: unknown[]) => {
    const response = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(30_000) });
    const body = await response.json() as { result?: unknown; error?: unknown };
    if (!response.ok || body.error || body.result == null) throw new Error(method + ' unavailable');
    return body.result;
  };
  const tx = await rpc('eth_getTransactionByHash', [hash]) as Record<string, unknown>;
  const limits = [...new Set([quantity(tx.gas), ...values.map(v => BigInt(v))])];
  for (const gas of limits) {
    const { call, block } = replayInput(tx, gas);
    const trace = await rpc('debug_traceCall', [call, block, { tracer: 'callTracer', timeout: '15s' }]) as Trace;
    quantity(trace.gasUsed);
    const failures: { depth: number; selector?: string; error: string; gas?: string; gasUsed?: string }[] = [];
    const visit = (entry: Trace, depth = 0) => {
      if (entry.error) failures.push({ depth, selector: entry.input?.slice(0, 10), error: entry.error,
        gas: entry.gas, gasUsed: entry.gasUsed });
      for (const child of entry.calls ?? []) visit(child, depth + 1);
    };
    visit(trace);
    console.log(JSON.stringify({ stateBasis: 'parent_block', blockNumber: BigInt(block).toString(),
      authorizationCount: Array.isArray(tx.authorizationList) ? tx.authorizationList.length : 0,
      gasLimit: gas.toString(), topLevelSuccess: !trace.error, gasUsed: trace.gasUsed, failures, transactionSent: false }));
  }
}

if (import.meta.main) main().catch(error => {
  // Network exceptions may contain credentials from a caller-supplied RPC URL.
  const message = error instanceof Error && /^(Usage:|HTTP RPC required|invalid |RPC quantity|eth_getTransactionByHash unavailable|debug_traceCall unavailable)/.test(error.message)
    ? error.message : 'Replay unavailable. Check the RPC archive/debug support and arguments.';
  console.error(message); process.exitCode = 1;
});
