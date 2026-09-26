// ABOUTME: Tests transaction outcome recovery and explicit wallet rejection semantics.
// ABOUTME: Ensures an unknown submission cannot be retried as a fresh transaction.
import { expect, test } from 'bun:test';
import { Submission, validatePending, type Pending } from '../../web/submission';

const draft = { kind: 'publish', name: 'demo.eth', to: '0x' + '11'.repeat(20), data: '0x1234' } as Pending;
test('wallet rejection clears pending state without reporting success', async () => {
  const saved: (Pending | null)[] = [];
  const submission = new Submission(value => saved.push(value));
  await expect(submission.submit(draft, async () => { throw { code: 4001 }; })).rejects.toThrow('wallet_rejected');
  expect(submission.pending).toBeNull();
  expect(saved.at(-1)).toBeNull();
});
test('transport failure retains an unknown operation and blocks resubmission', async () => {
  const submission = new Submission(() => {});
  await expect(submission.submit(draft, async () => { throw new Error('connection lost'); })).rejects.toThrow('submission_unknown');
  expect(submission.pending?.hash).toBeUndefined();
  await expect(submission.submit(draft, async () => '0x1234')).rejects.toThrow('pending_transaction');
});
test('a returned hash is persisted before receipt verification', async () => {
  const saved: (Pending | null)[] = [];
  const submission = new Submission(value => saved.push(value));
  expect(await submission.submit(draft, async () => '0x1234')).toBe('0x1234');
  expect(saved.at(-1)?.hash).toBe('0x1234');
  submission.complete();
  expect(submission.pending).toBeNull();
});
test('recovery imports require an exact supported operation and an identified sender', () => {
  const recovery = { ...draft, account: '0x' + '22'.repeat(20), kind: 'bind', value: '0x' + '33'.repeat(20) };
  expect(validatePending(recovery).name).toBe('demo.eth');
  expect(() => validatePending({ ...recovery, hash: '0x1234' })).toThrow();
  expect(() => validatePending({ ...recovery, kind: 'transfer' })).toThrow();
  expect(() => validatePending({ ...recovery, account: undefined })).toThrow();
  expect(() => validatePending({ ...recovery, data: '0x123' })).toThrow();
  expect(() => validatePending({ ...recovery, key: 'url' })).toThrow('invalid_recovery');
});

test('agent recovery accepts only explicitly permitted profile keys', () => {
  const recovery = { ...draft, name: 'agent.demo.eth', kind: 'grant-profile', account: '0x' + '22'.repeat(20),
    helper: '0x' + '33'.repeat(20), key: 'url' };
  expect(validatePending(recovery).key).toBe('url');
  expect(() => validatePending({ ...recovery, key: 'devouch.vouch' })).toThrow('unsupported_agent_permission');
  expect(() => validatePending({ ...recovery, helper: undefined })).toThrow();
  expect(() => validatePending({ ...recovery, key: undefined })).toThrow();
});
