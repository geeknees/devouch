// ABOUTME: Exercises gas preflight through the wallet boundary before any pending operation is saved.
// ABOUTME: Rejects unavailable estimates, insufficient gas, and account or chain changes without sending.
import { expect, test } from 'bun:test';
import { toHex, type EIP1193Provider, type Hex } from 'viem';
import { Erc8004Reader } from '../../src/erc8004';
import { DEFAULT_DEPLOYMENT } from '../../src/erc8004-deployment';
import { validateTransactionPlan } from '../../src/erc8004-operations';
import { Submission } from '../../web/submission';
import { WalletSession } from '../../web/wallet';

const owner = '0x1111111111111111111111111111111111111111';
const hash = ('0x' + '12'.repeat(32)) as Hex, blockHash = '0x' + '34'.repeat(32);
const plan = () => validateTransactionPlan({ format: 'devouch-erc8004-plan-v1', operation: 'register',
  deployment: DEFAULT_DEPLOYMENT, from: owner, agentId: null, subject: null, feedbackData: null, feedbackIndex: null,
  snapshot: { blockNumber: '10', blockHash, timestamp: '1000' },
  transaction: { to: DEFAULT_DEPLOYMENT.registry.identityRegistry, data: '0x1aa3a008', value: '0x0' } });

function fixture() {
  const state = { estimate: '0x5e33b' as unknown, blockGas: toHex(30_000_000n) as unknown, account: owner,
    chain: toHex(DEFAULT_DEPLOYMENT.chainId), timestamp: 1001n, estimateError: false, simulationError: false,
    afterEstimate: () => {} };
  const calls: { method: string; params?: unknown[] }[] = [], saved: unknown[] = [];
  const submission = new Submission(value => saved.push(value));
  const provider = { request: async (request: { method: string; params?: unknown[] }) => {
    calls.push(request);
    switch (request.method) {
      case 'eth_requestAccounts': case 'eth_accounts': return [state.account];
      case 'eth_chainId': return state.chain;
      case 'eth_estimateGas':
        expect(submission.pending).toBeNull();
        if (state.estimateError) throw new Error('estimate failed');
        state.afterEstimate(); return state.estimate;
      case 'eth_getBlockByNumber': return { gasLimit: state.blockGas };
      case 'eth_call':
        if (state.simulationError) throw new Error('out of gas');
        return '0x';
      case 'eth_sendTransaction':
        expect(saved.length).toBe(1); expect(submission.pending?.hash).toBeNull(); return hash;
      default: throw new Error('unexpected method: ' + request.method);
    }
  } } as unknown as EIP1193Provider;
  const reader = new Erc8004Reader('http://127.0.0.1:1');
  Object.assign(reader, { registryPin: async () => DEFAULT_DEPLOYMENT.registry });
  Object.assign(reader.client, { getChainId: async () => DEFAULT_DEPLOYMENT.chainId, call: async () => '0x',
    getBlock: async ({ blockNumber }: { blockNumber?: bigint }) => ({ number: blockNumber ?? 11n, hash: blockHash,
      timestamp: blockNumber === 10n ? 1000n : state.timestamp }) });
  const wallet = new WalletSession(provider, reader, submission);
  return { state, calls, saved, submission, wallet };
}

test('the exact zero-value call is estimated and simulated with a rounded-up 25 percent gas buffer before sending', async () => {
  const f = fixture(), p = plan(); await f.wallet.connect();
  expect(await f.wallet.send(p)).toBe(hash);
  const request = { from: owner, ...p.transaction, chainId: toHex(DEFAULT_DEPLOYMENT.chainId) };
  const gas = toHex(482_314n);
  expect(f.calls.find(call => call.method === 'eth_estimateGas')?.params).toEqual([request]);
  expect(f.calls.find(call => call.method === 'eth_call')?.params).toEqual([{ ...request, gas }, 'latest']);
  expect(f.calls.find(call => call.method === 'eth_sendTransaction')?.params).toEqual([{ ...request, gas }]);
  expect(f.submission.pending?.hash).toBe(hash); expect(f.saved.length).toBe(2);
});

for (const [name, change, reason] of [
  ['failed estimate', (f: ReturnType<typeof fixture>) => { f.state.estimateError = true; }, 'gas_estimation_failed'],
  ['zero estimate', (f: ReturnType<typeof fixture>) => { f.state.estimate = '0x0'; }, 'gas_estimate_invalid'],
  ['non-hex estimate', (f: ReturnType<typeof fixture>) => { f.state.estimate = '385851'; }, 'gas_estimate_invalid'],
  ['non-string estimate', (f: ReturnType<typeof fixture>) => { f.state.estimate = 385851; }, 'gas_estimate_invalid'],
  ['estimate with trailing whitespace', (f: ReturnType<typeof fixture>) => { f.state.estimate = '0x5e33b\n'; }, 'gas_estimate_invalid'],
  ['missing block limit', (f: ReturnType<typeof fixture>) => { f.state.blockGas = undefined; }, 'gas_block_unavailable'],
  ['buffer above block limit', (f: ReturnType<typeof fixture>) => { f.state.blockGas = f.state.estimate; }, 'gas_limit_exceeds_block'],
  ['failed bounded simulation', (f: ReturnType<typeof fixture>) => { f.state.simulationError = true; }, 'gas_simulation_failed'],
  ['wallet changes during estimation', (f: ReturnType<typeof fixture>) => { f.state.afterEstimate = () => {
    f.state.account = '0x2222222222222222222222222222222222222222'; }; }, 'wallet_changed'],
  ['network changes during estimation', (f: ReturnType<typeof fixture>) => { f.state.afterEstimate = () => {
    f.state.chain = '0x1'; }; }, 'wrong_chain'],
  ['plan expires during estimation', (f: ReturnType<typeof fixture>) => { f.state.afterEstimate = () => {
    f.state.timestamp = 1901n; }; }, 'request_stale'],
] as const) test(`${name} does not send or create a pending operation`, async () => {
  const f = fixture(); await f.wallet.connect(); change(f);
  await expect(f.wallet.send(plan())).rejects.toThrow(reason);
  expect(f.calls.some(call => call.method === 'eth_sendTransaction')).toBe(false);
  expect(f.submission.pending).toBeNull(); expect(f.saved).toEqual([]);
});

test('a tampered plan cannot reach the wallet gas estimator', async () => {
  const f = fixture(), p = plan(); await f.wallet.connect(); p.transaction.data = '0x';
  await expect(f.wallet.send(p)).rejects.toThrow('transaction_plan_mismatch');
  expect(f.calls.some(call => call.method === 'eth_estimateGas')).toBe(false);
});
