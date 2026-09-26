// ABOUTME: Checks pre-submission decisions with the real Ruby CLI and official ENS contracts on a local EVM.
// ABOUTME: Replaces only GitHub data, preserving signature, subject, history, snapshot, and policy verification.
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { domain, typedData } from '../../src/credential';
import { RESOLVER_IMPL, setTextData } from '../../src/ens';
import { validatePublishRequest } from '../../src/operations';
import { issuer, publicClient, setupEvm, settle, testRpc, wallet } from '../support/evm';

async function cli(args: string[], fixture?: string) {
  const process = Bun.spawn(['ruby', ...(fixture ? ['test/support/check-cli.rb', fixture] : ['exe/devouch']),
    ...args, '--rpc-url', testRpc, '--json'], { stdout: 'pipe', stderr: 'pipe' });
  const raw = await new Response(process.stdout).text();
  return { status: await process.exited, report: JSON.parse(raw) };
}

test('check reuses real evidence, pins destination policy, and refuses mismatched and withdrawn endorsements', async () => {
  const { name, resolver } = await setupEvm();
  await settle();
  const dir = await mkdtemp(join(tmpdir(), 'devouch-check-e2e-'));
  try {
    const requestPath = join(dir, 'request.json'), vouchPath = join(dir, 'vouch.json'), fixturePath = join(dir, 'github.json');
    const expires = new Date((Number((await publicClient.getBlock()).timestamp) + 3600) * 1000).toISOString().replace('.000Z', 'Z');
    expect((await cli(['request', '--subject', 'github:12345', '--issuer', issuer.address, '--name', name,
      '--expires-at', expires, '--output', requestPath])).status).toBe(0);
    const request = validatePublishRequest(JSON.parse(await readFile(requestPath, 'utf8')));
    const raw = JSON.stringify({ formatVersion: 1, domain: domain(request.message), endorsement: {
      message: request.message, signature: await issuer.signTypedData(typedData(request.message)) } });
    const hash = await wallet.sendTransaction({ to: resolver, data: setTextData(name, raw) });
    await publicClient.waitForTransactionReceipt({ hash });
    await settle();
    await writeFile(vouchPath, raw);
    const policy = { repositoryId: 'demo/repo', chainId: 11155111, trustedIssuers: [issuer.address],
      allowedScopes: ['oss-contribution'], allowedResolvers: [{ address: resolver, implementation: RESOLVER_IMPL }], requiredIssuers: 1 };
    const fixture = { repository: 'demo/repo', branch: 'release/v1', sha: 'a'.repeat(40), policy: JSON.stringify(policy) };
    await writeFile(fixturePath, JSON.stringify(fixture));
    const check = (subject = 'github:12345') => cli(['check', '--repo', 'demo/repo', '--base', 'release/v1',
      '--credential', vouchPath, '--subject', subject], fixturePath);
    const files = (await readdir(dir)).sort();
    const accepted = await check();
    expect(accepted.status).toBe(0);
    expect(accepted.report).toMatchObject({ command: 'check', submitted: false, evidence_status: 'valid', policy_status: 'accepted',
      subject_source: 'argument', human_verification: 'not_included',
      github: { repository: 'demo/repo', base_branch: 'release/v1', base_sha: fixture.sha, policy_path: '.devouch/policy.json' },
      policy: { repository_id: 'demo/repo', digest: 'sha256:' + createHash('sha256').update(fixture.policy).digest('hex') } });
    expect(accepted.report.snapshot.block_hash).toMatch(/^0x[0-9a-f]{64}$/);
    const mismatch = await check('github:67890');
    expect(mismatch.status).toBe(2);
    expect(mismatch.report).toMatchObject({ evidence_status: 'invalid', policy_status: 'not_evaluated', reason_codes: ['subject_mismatch'] });
    await writeFile(fixturePath, JSON.stringify({ ...fixture, policy: JSON.stringify({ ...policy, trustedIssuers: [] }) }));
    const rejected = await check();
    expect(rejected.status).toBe(1);
    expect(rejected.report).toMatchObject({ evidence_status: 'valid', policy_status: 'rejected', reason_codes: ['issuer_not_trusted'] });
    const withdrawn = await wallet.sendTransaction({ to: resolver, data: setTextData(name, '') });
    await publicClient.waitForTransactionReceipt({ hash: withdrawn });
    await settle();
    const revoked = await check();
    expect(revoked.status).toBe(2);
    expect(revoked.report).toMatchObject({ evidence_status: 'revoked', policy_status: 'not_evaluated', submitted: false });
    expect(await readFile(vouchPath, 'utf8')).toBe(raw);
    expect((await readdir(dir)).sort()).toEqual(files);
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 120000);
