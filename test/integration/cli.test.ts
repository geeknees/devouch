// ABOUTME: Runs the real Ruby CLI, bundled Node bridge, and official ENSv2 contracts together.
// ABOUTME: Proves cross-repository reuse and revocation without substituting a verification fixture.
import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { domain, typedData } from '../../src/credential';
import { RESOLVER_IMPL, setTextData } from '../../src/ens';
import { validatePublishRequest } from '../../src/operations';
import { issuer, publicClient, setupEvm, settle, testRpc, wallet } from '../support/evm';

async function cli(args: string[]) {
  const process = Bun.spawn(['ruby', 'exe/devouch', ...args, '--rpc-url', testRpc, '--json'], { stdout: 'pipe', stderr: 'pipe' });
  const raw = await new Response(process.stdout).text();
  return { status: await process.exited, report: JSON.parse(raw) };
}

test('real CLI prepares, fetches, evaluates two policies, and observes direct revocation', async () => {
  const { name, resolver } = await setupEvm();
  await settle();
  const dir = await mkdtemp(join(tmpdir(), 'devouch-e2e-'));
  try {
    const requestPath = join(dir, 'request.json'), vouchPath = join(dir, 'vouch.json'), hintPath = join(dir, 'publication.json');
    const policyA = join(dir, 'repo-a.json'), policyB = join(dir, 'repo-b.json'), revokePath = join(dir, 'revoke.json');
    const expires = new Date((Number((await publicClient.getBlock()).timestamp) + 3600) * 1000).toISOString().replace('.000Z', 'Z');
    const requested = await cli(['request', '--subject', 'github:12345', '--issuer', issuer.address, '--name', name, '--expires-at', expires, '--output', requestPath]);
    expect(requested.report).toMatchObject({ operation_status: 'prepared', submitted: false });
    expect(requested.status).toBe(0);
    const request = validatePublishRequest(JSON.parse(await readFile(requestPath, 'utf8')));
    const raw = JSON.stringify({ formatVersion: 1, domain: domain(request.message), endorsement: {
      message: request.message, signature: await issuer.signTypedData(typedData(request.message)) } });
    const publication = await wallet.sendTransaction({ to: resolver, data: setTextData(name, raw) });
    await publicClient.waitForTransactionReceipt({ hash: publication });
    await settle();
    const fetched = await cli(['fetch', '--name', name, '--output', vouchPath, '--publication-output', hintPath]);
    expect(fetched.status).toBe(0);
    expect(await readFile(vouchPath, 'utf8')).toBe(raw);
    const policy = { repositoryId: 'demo/repo-a', chainId: 11155111, trustedIssuers: [issuer.address],
      allowedScopes: ['oss-contribution'], allowedResolvers: [{ address: resolver, implementation: RESOLVER_IMPL }], requiredIssuers: 1 };
    await writeFile(policyA, JSON.stringify(policy));
    await writeFile(policyB, JSON.stringify({ ...policy, repositoryId: 'demo/repo-b' }));
    const verify = (path: string, id = 'github:12345') => cli(['verify', '--credential', vouchPath, '--policy', path, '--subject', id]);
    expect((await verify(policyA)).report).toMatchObject({ evidence_status: 'valid', policy_status: 'accepted', human_verification: 'not_included' });
    expect((await verify(policyB)).status).toBe(0);
    await writeFile(policyB, JSON.stringify({ ...policy, repositoryId: 'demo/repo-b', trustedIssuers: [] }));
    expect((await verify(policyB)).report).toMatchObject({ evidence_status: 'valid', policy_status: 'rejected' });
    expect((await verify(policyA, 'github:67890')).report).toMatchObject({ evidence_status: 'invalid', reason_codes: ['subject_mismatch'] });
    expect((await cli(['revoke', '--credential', vouchPath, '--output', revokePath])).report).toMatchObject({ operation_status: 'prepared', submitted: false });
    const revoked = await wallet.sendTransaction({ to: resolver, data: setTextData(name, '') });
    await publicClient.waitForTransactionReceipt({ hash: revoked });
    await settle();
    for (const path of [policyA, policyB]) expect((await verify(path)).report).toMatchObject({ evidence_status: 'revoked', policy_status: 'not_evaluated' });
    const archived = join(dir, 'archived.json');
    expect((await cli(['fetch', '--name', name, '--publication', hintPath, '--output', archived])).status).toBe(0);
    expect(await readFile(archived, 'utf8')).toBe(raw);
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 120000);
