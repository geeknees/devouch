// ABOUTME: Verifies recovery of a wallet-returned wrapped transaction only after its canonical receipt proves failure.
// ABOUTME: Keeps unknown submissions, unrelated hashes, and successful wrappers pending for exact verification.
import { expect, test } from 'bun:test';
import type { EIP1193Provider, Hex } from 'viem';
import { Erc8004Reader } from '../../src/erc8004';
import { DEFAULT_DEPLOYMENT } from '../../src/erc8004-deployment';
import { confirmTransaction, validateTransactionPlan } from '../../src/erc8004-operations';
import { Submission } from '../../web/submission';
import { WalletSession } from '../../web/wallet';

const hash = ('0x' + '12'.repeat(32)) as Hex;
const blockHash = ('0x' + '34'.repeat(32)) as Hex;
const otherHash = ('0x' + '56'.repeat(32)) as Hex;
const owner = '0x1111111111111111111111111111111111111111';
const wrapper = '0x2222222222222222222222222222222222222222';
const plan = validateTransactionPlan({ format: 'devouch-erc8004-plan-v1', operation: 'register',
  deployment: DEFAULT_DEPLOYMENT, from: owner, agentId: null, subject: null, feedbackData: null, feedbackIndex: null,
  snapshot: { blockNumber: '10', blockHash: otherHash, timestamp: '1000' },
  transaction: { to: DEFAULT_DEPLOYMENT.registry.identityRegistry, data: '0x1aa3a008', value: '0x0' } });

function fixture(savedHash: Hex | null = hash) {
  const tx = { hash, from: owner, to: wrapper, input: '0xabcdef', value: 0n, blockNumber: 11n, blockHash };
  const receipt = { status: 'reverted', transactionHash: hash, blockNumber: 11n, blockHash, logs: [] };
  const block = { hash: blockHash };
  let chainId = DEFAULT_DEPLOYMENT.chainId;
  const reader = new Erc8004Reader('http://127.0.0.1:1');
  Object.assign(reader.client, {
    getChainId: async () => chainId,
    getTransaction: async () => tx,
    getTransactionReceipt: async () => receipt,
    getBlock: async () => block,
  });
  const saved: unknown[] = [];
  const submission = new Submission(value => saved.push(value), { plan, hash: savedHash });
  const wallet = new WalletSession(undefined as unknown as EIP1193Provider, reader, submission);
  return { reader, tx, receipt, block, submission, wallet, saved, chain: (value: number) => { chainId = value; } };
}

test('a reverted wrapper with the recorded wallet hash clears pending without claiming registration', async () => {
  const f = fixture();
  expect(await f.wallet.recover(hash)).toEqual({ status: 'reverted', hash });
  expect(f.submission.pending).toBeNull(); expect(f.saved).toEqual([null]);
});

test('a manually supplied hash cannot release an unknown wrapped submission', async () => {
  const f = fixture(null);
  await expect(f.wallet.recover(hash)).rejects.toThrow('transaction_mismatch');
  expect(f.submission.pending).not.toBeNull(); expect(f.saved).toEqual([]);
});

test('an unrelated recorded wallet hash cannot authorize a wrapped receipt', async () => {
  const f = fixture(otherHash);
  await expect(f.wallet.recover(hash)).rejects.toThrow('transaction_mismatch');
  expect(f.submission.pending).not.toBeNull();
});

test('a successful wrapper is not accepted as the reviewed operation', async () => {
  const f = fixture(); f.receipt.status = 'success';
  await expect(f.wallet.recover(hash)).rejects.toThrow('transaction_mismatch');
  expect(f.submission.pending).not.toBeNull(); expect(f.saved).toEqual([]);
});

test('receipt recovery without a recorded wallet submission still requires exact calldata', async () => {
  const f = fixture();
  await expect(confirmTransaction(f.reader, plan, hash)).rejects.toThrow('transaction_mismatch');
  f.tx.to = plan.transaction.to; f.tx.input = plan.transaction.data;
  expect(await confirmTransaction(f.reader, plan, hash)).toEqual({ status: 'reverted', hash });
});

for (const [name, change, error] of [
  ['wrong sender', (f: ReturnType<typeof fixture>) => { f.tx.from = wrapper; }, 'transaction_mismatch'],
  ['nonzero value', (f: ReturnType<typeof fixture>) => { f.tx.value = 1n; }, 'transaction_mismatch'],
  ['wrong receipt hash', (f: ReturnType<typeof fixture>) => { f.receipt.transactionHash = otherHash; }, 'transaction_mismatch'],
  ['wrong transaction hash', (f: ReturnType<typeof fixture>) => { f.tx.hash = otherHash; }, 'transaction_mismatch'],
  ['transaction in another block', (f: ReturnType<typeof fixture>) => { f.tx.blockNumber = 12n; }, 'transaction_mismatch'],
  ['transaction with another block hash', (f: ReturnType<typeof fixture>) => { f.tx.blockHash = otherHash; }, 'transaction_mismatch'],
  ['receipt before preparation', (f: ReturnType<typeof fixture>) => { f.receipt.blockNumber = 10n; }, 'transaction_mismatch'],
  ['reorganized block', (f: ReturnType<typeof fixture>) => { f.block.hash = otherHash; }, 'snapshot_changed'],
  ['wrong network', (f: ReturnType<typeof fixture>) => { f.chain(1); }, 'wrong_chain'],
] as const) test(`${name} leaves the operation pending`, async () => {
  const f = fixture(); change(f);
  await expect(f.wallet.recover(hash)).rejects.toThrow(error);
  expect(f.submission.pending).not.toBeNull(); expect(f.saved).toEqual([]);
});
