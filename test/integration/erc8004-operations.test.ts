// ABOUTME: Exercises real registry operations, receipt recovery, and the shipped Ruby CLI end to end.
// ABOUTME: Verifies third-party feedback, stale-plan rejection, exact transaction matching, and revocation on local bytecode.
import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EIP1193Provider, Hex } from 'viem';
import { setupErc8004 } from '../support/erc8004';
import { prepareTransaction, confirmTransaction, validateCurrentPlan, type TransactionPlan } from '../../src/erc8004-operations';
import type { Deployment } from '../../src/erc8004-deployment';
import { WalletSession } from '../../web/wallet';
import { Submission } from '../../web/submission';
import { identityAbi, MAPPING_KEY } from '../../src/erc8004';
import { stringToHex } from 'viem';

const cli = async (args: string[]) => {
  const process = Bun.spawn(['ruby', 'exe/devouch', ...args, '--rpc-url', processEnvRpc(), '--json'], { stdout: 'pipe', stderr: 'pipe' });
  const [status, output, error] = await Promise.all([process.exited, new Response(process.stdout).text(), new Response(process.stderr).text()]);
  expect(error).toBe(''); return { status, report: JSON.parse(output) };
};
const processEnvRpc = () => process.env.DEVOUCH_TEST_RPC!;

test('wallet registration, owner mapping, CLI request/fetch/verify, and evaluator revocation use the same real registries', async () => {
  const f = await setupErc8004(processEnvRpc(), false), directory = await mkdtemp(join(tmpdir(), 'devouch-erc-product-'));
  const deployment: Deployment = { format: 'devouch-erc8004-deployment-v1', chainId: 11155111, registry: f.policy.allowedRegistries[0]! };
  let account = f.owner, sends = 0, estimates = 0, estimatedGas = 0n;
  const provider = { request: async ({ method, params }: { method: string; params?: unknown[] }) => {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
    if (method === 'eth_estimateGas') {
      estimates++; const value = await f.rpc(method, params); estimatedGas = BigInt(String(value)); return value;
    }
    if (method === 'eth_sendTransaction') {
      sends++;
      expect(BigInt((params![0] as { gas: string }).gas)).toBe((estimatedGas * 5n + 3n) / 4n);
    }
    return f.rpc(method, params);
  } } as unknown as EIP1193Provider;
  const submission = new Submission(() => {}), session = new WalletSession(provider, f.reader, submission);
  const submit = async (plan: TransactionPlan) => {
    account = plan.from; await session.connect();
    const hash = await session.send(plan); expect(submission.pending?.hash).toBe(hash);
    const confirmed = await session.recover(hash); expect(submission.pending).toBeNull();
    return { hash, confirmed };
  };
  try {
    const config = join(directory, 'deployment.json'), policy = join(directory, 'policy.json');
    await Bun.write(config, JSON.stringify(deployment)); await Bun.write(policy, JSON.stringify(f.policy));
    const regPath = join(directory, 'register.json');
    expect((await cli(['register', '--owner', f.owner, '--deployment', config, '--output', regPath])).status).toBe(0);
    expect(sends).toBe(0);
    const registered = await submit(await Bun.file(regPath).json());
    expect(registered.confirmed.agentId).toBe('1');
    const newerPlan = await prepareTransaction(f.reader, deployment, { operation: 'register', from: f.owner });
    await expect(confirmTransaction(f.reader, newerPlan, registered.hash)).rejects.toThrow('transaction_mismatch');
    const mappingPath = join(directory, 'map.json');
    expect((await cli(['map', '--owner', f.owner, '--agent-id', '1', '--subject', f.subject, '--deployment', config, '--output', mappingPath])).status).toBe(0);
    await submit(await Bun.file(mappingPath).json());
    const requestPath = join(directory, 'request.json');
    const expiry = new Date((Number((await f.client.getBlock()).timestamp) + 3600) * 1000).toISOString().replace('.000Z', 'Z');
    const request = await cli(['request', '--agent-id', '1', '--subject', f.subject, '--issuer', f.evaluator,
      '--expires-at', expiry, '--deployment', config, '--output', requestPath]);
    expect(request.status).toBe(0); expect(request.report.submitted).toBe(false);
    const plan = await Bun.file(requestPath).json() as TransactionPlan;
    const sent = await submit(plan); expect(sent.confirmed.status).toBe('confirmed');
    const reference = sent.confirmed.reference!; expect(reference.agentId).toBe('1');
    await expect(confirmTransaction(f.reader, plan, registered.hash)).rejects.toThrow('transaction_mismatch');
    const path = join(directory, 'feedback.json');
    expect((await cli(['fetch', '--agent-id', '1', '--issuer', f.evaluator, '--feedback-index', reference.feedbackIndex,
      '--feedback-block', reference.feedbackBlock, '--deployment', config, '--output', path])).status).toBe(0);
    expect(JSON.stringify(await Bun.file(path).json()).toLowerCase()).toBe(JSON.stringify(reference).toLowerCase());
    const verify = ['verify', '--credential', path, '--policy', policy, '--subject', f.subject];
    const valid = await cli(verify); expect(valid.status).toBe(0);
    expect(valid.report).toMatchObject({ report_version: 2, evidence_status: 'valid', policy_status: 'accepted',
      declaration: { account_ownership: 'not_verified' } });
    const action = async (rpc = processEnvRpc(), raw: string | null = JSON.stringify(reference)) => {
      const child = Bun.spawn(['ruby', 'test/support/action.rb'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
      child.stdin.write(JSON.stringify({ repository: f.policy.repositoryId, subject: f.subject,
        policy: JSON.stringify(f.policy), reference: raw, rpc }));
      child.stdin.end();
      expect(await new Response(child.stderr).text()).toBe('');
      const output = await new Response(child.stdout).text(); expect(await child.exited).toBe(0);
      return JSON.parse(output);
    };
    expect(await action()).toMatchObject({ action_exit_status: 0, report_version: 2,
      evidence_status: 'valid', policy_status: 'accepted', github: { subject_source: 'github_pull_request_author' } });
    expect(await action(processEnvRpc(), null)).toMatchObject({ action_exit_status: 0,
      evidence_status: 'missing', policy_status: 'not_evaluated' });
    expect(await action('http://127.0.0.1:1')).toMatchObject({ action_exit_status: 1,
      evidence_status: 'unavailable', policy_status: 'not_evaluated' });
    await Bun.write(policy, JSON.stringify({ ...f.policy, trustedIssuers: [] }));
    expect((await cli(verify)).status).toBe(1);
    await Bun.write(policy, JSON.stringify(f.policy));
    const revPath = join(directory, 'revoke.json');
    expect((await cli(['revoke', '--credential', path, '--deployment', config, '--output', revPath])).status).toBe(0);
    await submit(await Bun.file(revPath).json());
    const revoked = await cli(verify); expect(revoked.status).toBe(2);
    expect(revoked.report).toMatchObject({ evidence_status: 'revoked', policy_status: 'not_evaluated' });
    expect(await action()).toMatchObject({ action_exit_status: 0,
      evidence_status: 'revoked', policy_status: 'not_evaluated' });
    expect(sends).toBe(4); expect(estimates).toBe(4);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);

test('state changes, a stale preparation, and a changed wallet cannot send the previously reviewed operation', async () => {
  const f = await setupErc8004(processEnvRpc(), false);
  const deployment: Deployment = { format: 'devouch-erc8004-deployment-v1', chainId: 11155111, registry: f.policy.allowedRegistries[0]! };
  const block = await f.client.getBlock();
  const plan = await prepareTransaction(f.reader, deployment, { operation: 'feedback', from: f.evaluator, agentId: '0',
    subject: f.subject, expiresAt: (block.timestamp + 3600n).toString() });
  await expect(prepareTransaction(f.reader, deployment, { operation: 'feedback', from: f.owner, agentId: '0', subject: f.subject,
    expiresAt: (block.timestamp + 3600n).toString() })).rejects.toThrow('issuer_is_owner_or_operator');
  const snapshot = await f.rpc('evm_snapshot');
  await f.write(f.owner, f.identityRegistry, identityAbi, 'setMetadata', [0n, MAPPING_KEY, stringToHex('github:999')]);
  await expect(validateCurrentPlan(f.reader, plan)).rejects.toThrow('github_mapping_mismatch');
  await f.rpc('evm_revert', [snapshot]);
  await f.rpc('evm_setNextBlockTimestamp', [Number(plan.snapshot.timestamp) + 901]); await f.rpc('evm_mine');
  await expect(validateCurrentPlan(f.reader, plan)).rejects.toThrow('request_stale');
  let sends = 0;
  const provider = { request: async ({ method }: { method: string }) => {
    if (method === 'eth_requestAccounts') return [f.evaluator];
    if (method === 'eth_accounts') return [f.owner];
    sends++; return '0x' + '11'.repeat(32);
  } } as unknown as EIP1193Provider;
  const submission = new Submission(() => {}), wallet = new WalletSession(provider, f.reader, submission);
  await wallet.connect(); await expect(wallet.send(plan)).rejects.toThrow('wallet_changed');
  expect(submission.pending).toBeNull(); expect(sends).toBe(0);
}, 30000);
