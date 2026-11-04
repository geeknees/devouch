// ABOUTME: Tests unknown wallet delivery and recovery imports for reviewed ERC-8004 calls.
// ABOUTME: Preserves cancellation, persistence-before-send, duplicate-send, and calldata safety boundaries.
import { expect, test } from 'bun:test';
import { encodeFunctionData } from 'viem';
import { identityAbi } from '../../src/erc8004';
import { DEFAULT_DEPLOYMENT } from '../../src/erc8004-deployment';
import { validateTransactionPlan } from '../../src/erc8004-operations';
import { Submission, validatePending } from '../../web/submission';
const plan = () => validateTransactionPlan({ format: 'devouch-erc8004-plan-v1', operation: 'register',
  deployment: DEFAULT_DEPLOYMENT, from: '0x1111111111111111111111111111111111111111', agentId: null, subject: null,
  feedbackData: null, feedbackIndex: null, snapshot: { blockNumber: '10', blockHash: '0x' + 'aa'.repeat(32), timestamp: '1000' },
  transaction: { to: DEFAULT_DEPLOYMENT.registry.identityRegistry, data: encodeFunctionData({ abi: identityAbi, functionName: 'register' }), value: '0x0' } });

test('wallet rejection clears pending state without reporting success', async () => {
  const saved: unknown[] = [], submission = new Submission(p => saved.push(p));
  await expect(submission.send(plan(), async () => { throw { code: 4001 }; })).rejects.toThrow('wallet_rejected');
  expect(submission.pending).toBeNull(); expect(saved.length).toBe(2);
});
test('transport failure retains an unknown operation and blocks resubmission', async () => {
  const submission = new Submission(() => {});
  await expect(submission.send(plan(), async () => { throw new Error('network'); })).rejects.toThrow('submission_unknown');
  expect(submission.pending?.hash).toBeNull();
  await expect(submission.send(plan(), async () => '0x' + '12'.repeat(32))).rejects.toThrow('pending_transaction');
});
test('a returned hash is persisted only after the operation was saved before wallet submission', async () => {
  const saved: unknown[] = [], submission = new Submission(p => saved.push(p));
  const hash = await submission.send(plan(), async () => { expect(saved.length).toBe(1); return '0x' + '12'.repeat(32); });
  expect(saved.length).toBe(2); expect(submission.pending?.hash).toBe(hash);
});
test('unavailable storage prevents wallet submission', async () => {
  let calls = 0;
  const submission = new Submission(() => { throw new Error('storage unavailable'); });
  await expect(submission.send(plan(), async () => { calls++; return '0x' + '12'.repeat(32); })).rejects.toThrow();
  expect(calls).toBe(0);
});
test('recovery imports reject altered transaction bytes and unexpected public fields', () => {
  const p = plan();
  expect(validatePending({ plan: p, hash: null }).plan).toEqual(p);
  for (const tx of [{ ...p.transaction, value: '0x1' }, { ...p.transaction, data: '0x' },
    { ...p.transaction, to: p.from }]) expect(() => validatePending({ plan: { ...p, transaction: tx }, hash: null })).toThrow();
  expect(() => validatePending({ plan: p, hash: null, privateKey: 'never accepted' })).toThrow();
});
