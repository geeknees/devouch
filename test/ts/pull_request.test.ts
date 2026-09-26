// ABOUTME: Checks public PR identity, immutable file selection, and bounded anonymous GitHub reads.
// ABOUTME: Proves that only a signature bound to the PR author reaches the existing chain verifier.
import { expect, test } from 'bun:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { domain, typedData, validateMessage } from '../../src/credential';
import { EvidenceError } from '../../src/errors';
import { GitHubReader, parsePullRequestUrl } from '../../src/github';
import { verifyPullRequest } from '../../src/pull-request';
import type { ChainEvidence, ChainReader } from '../../src/chain';

const url = 'https://github.com/maintainer/repo/pull/7';
const base = 'a'.repeat(40), head = 'b'.repeat(40);
const account = privateKeyToAccount(generatePrivateKey());
const resolver = `0x${'22'.repeat(20)}` as const, implementation = `0x${'33'.repeat(20)}` as const;
const policy = { repositoryId: 'maintainer/repo', chainId: 11155111, trustedIssuers: [account.address],
  allowedScopes: ['oss-contribution'], allowedResolvers: [{ address: resolver, implementation }], requiredIssuers: 1 };
const metadata = () => ({ number: 7, user: { login: 'contributor', id: 12345 },
  base: { sha: base, repo: { full_name: 'maintainer/repo' } },
  head: { sha: head, repo: { full_name: 'contributor/fork' } } });
const encoded = (raw: string) => ({ type: 'file', encoding: 'base64', size: new TextEncoder().encode(raw).length,
  content: Buffer.from(raw).toString('base64') });
async function credential(subject = 'github:12345') {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const message = validateMessage({ version: '1', id: `0x${'11'.repeat(32)}`, requestNonce: `0x${'44'.repeat(32)}`,
    issuer: account.address, subject, scope: 'oss-contribution', issuedAt: now.toString(), expiresAt: (now + 3600n).toString(),
    recordName: 'issuer.eth', resolver, recordId: '1', anchorStartBlock: '100' });
  return JSON.stringify({ formatVersion: 1, domain: domain(message), endorsement: { message,
    signature: await account.signTypedData(typedData(message)) } });
}
const proof = (status: ChainEvidence['evidence_status'] = 'valid'): ChainEvidence => ({
  evidence_status: status, reason_codes: status === 'valid' ? [] : [status], implementation,
  publication: null, current_value: '', snapshot: { chain_id: 11155111, block_number: '101',
    block_hash: `0x${'55'.repeat(32)}`, block_timestamp: '1000', checked_at: new Date().toISOString(), confirmations: 2 } });
function api(raw: string | null, policyRaw: string | null = JSON.stringify(policy), meta = metadata()) {
  const requests: { url: string; options: RequestInit }[] = [];
  const github = new GitHubReader(async (request, options) => {
    requests.push({ url: request, options });
    const value = request.includes('/pulls/') ? meta : request.includes('policy.json') ? policyRaw : raw;
    return value === null ? new Response('', { status: 404 }) : Response.json(typeof value === 'string' ? encoded(value) : value);
  });
  return { github, requests };
}

test('PR URLs normalize query, fragment, and standard PR subpages', () => {
  for (const suffix of ['', '/', '/files', '/commits', '/checks?x=1#diff']) {
    expect(parsePullRequestUrl(url + suffix)).toEqual({ repository: 'maintainer/repo', number: 7, url });
  }
});
test.each(['http://github.com/o/r/pull/1', 'https://example.com/o/r/pull/1', 'https://github.com@evil.test/o/r/pull/1',
  'https://user@github.com/o/r/pull/1', 'https://github.com:444/o/r/pull/1', 'https://github.com/o/r/issues/1',
  'https://github.com/o/r/pull/0', 'https://github.com/o/r/pull/9007199254740992',
  'https://github.com/o/r/pull/1/../../pull/2', 'https://github.com/o/%2er/pull/1',
  'https://github.com/o/r\\pull/1', 'https://github.com/o/r/pull/1\n/files'])('rejects an unsafe or ambiguous PR URL: %s', value => {
  expect(() => parsePullRequestUrl(value)).toThrow('invalid_pr_url');
});

test('reads the base policy and fork-head endorsement at immutable SHAs without credentials', async () => {
  const raw = await credential(), { github, requests } = api(raw);
  let inspected = '';
  const report = await verifyPullRequest(url, { inspect: async parsed => { inspected = parsed.raw; return proof(); } }, github);
  expect(inspected).toBe(raw);
  expect(report.pullRequest).toMatchObject({ repository: 'maintainer/repo', number: 7, authorId: '12345',
    authorLogin: 'contributor', baseSha: base, headSha: head, headRepository: 'contributor/fork' });
  expect(report.subject).toBe('github:12345');
  expect(report.decision).toEqual({ policy_status: 'accepted', reason_codes: [] });
  expect(report.policyDigest).toBe('sha256:' + new Bun.CryptoHasher('sha256').update(JSON.stringify(policy)).digest('hex'));
  expect(requests.map(request => request.url)).toEqual([
    'https://api.github.com/repos/maintainer/repo/pulls/7',
    `https://api.github.com/repos/maintainer/repo/contents/.devouch/policy.json?ref=${base}`,
    `https://api.github.com/repos/contributor/fork/contents/.devouch/vouches/github-12345.json?ref=${head}`,
  ]);
  for (const { options } of requests) {
    expect(options).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
    expect(new Headers(options.headers).has('authorization')).toBe(false);
  }
});

test('a different signed subject or invalid signature never reaches ENS verification', async () => {
  const altered = JSON.parse(await credential()); altered.endorsement.message.subject = 'github:999';
  for (const [raw, reason, signature] of [[await credential('github:999'), 'subject_mismatch', 'valid'],
    [JSON.stringify(altered), 'invalid_signature', 'invalid']] as const) {
    let calls = 0;
    const report = await verifyPullRequest(url, { inspect: async () => { calls++; return proof(); } }, api(raw).github);
    expect(calls).toBe(0);
    expect(report.evidence).toMatchObject({ evidence_status: 'invalid', reason_codes: [reason], snapshot: null });
    expect(report.signatureStatus).toBe(signature);
    expect(report.decision).toEqual({ policy_status: 'not_evaluated', reason_codes: [reason] });
  }
});
test('a missing endorsement is missing rather than accepted or rejected', async () => {
  const report = await verifyPullRequest(url, { inspect: async () => { throw new Error('must not inspect'); } }, api(null).github);
  expect(report.evidence).toMatchObject({ evidence_status: 'missing', reason_codes: ['credential_missing'] });
  expect(report.decision.policy_status).toBe('not_evaluated');
  expect(report.signatureStatus).toBe('not_verified');
});
test.each(['revoked', 'expired', 'invalid', 'missing'] as const)('preserves the existing verifier’s %s result', async status => {
  const report = await verifyPullRequest(url, { inspect: async () => proof(status) }, api(await credential()).github);
  expect(report.evidence.evidence_status).toBe(status);
  expect(report.signatureStatus).toBe('valid');
  expect(report.decision).toEqual({ policy_status: 'not_evaluated', reason_codes: [status] });
});
test('RPC failure remains unavailable, and valid evidence can be rejected by the real policy', async () => {
  const raw = await credential();
  const failing: Pick<ChainReader, 'inspect'> = { inspect: async () => { throw new EvidenceError('rpc_unavailable', 'unavailable'); } };
  const unavailable = await verifyPullRequest(url, failing, api(raw).github);
  expect(unavailable.evidence.evidence_status).toBe('unavailable');
  expect(unavailable.decision.policy_status).toBe('not_evaluated');
  const rejected = await verifyPullRequest(url, { inspect: async () => proof() },
    api(raw, JSON.stringify({ ...policy, trustedIssuers: [] })).github);
  expect(rejected.evidence.evidence_status).toBe('valid');
  expect(rejected.decision).toEqual({ policy_status: 'rejected', reason_codes: ['issuer_not_trusted'] });
});
test('missing, malformed, or foreign base policies stop before reading the endorsement', async () => {
  for (const [raw, code] of [[null, 'policy_missing'], ['{}', 'invalid_policy'],
    [JSON.stringify({ ...policy, repositoryId: 'attacker/repo' }), 'policy_repository_mismatch']] as const) {
    const { github, requests } = api(await credential(), raw);
    await expect(verifyPullRequest(url, { inspect: async () => proof() }, github)).rejects.toMatchObject({ code });
    expect(requests.length).toBe(2);
  }
});
test('PR metadata must match the requested repository, number, and a supported author ID', async () => {
  for (const modify of [(m: ReturnType<typeof metadata>) => { m.number = 8; },
    (m: ReturnType<typeof metadata>) => { m.base.repo.full_name = 'attacker/repo'; },
    (m: ReturnType<typeof metadata>) => { m.user.id = 9007199254740992; },
    (m: ReturnType<typeof metadata>) => { m.head.sha = 'main'; }]) {
    const meta = metadata(); modify(meta);
    const { github, requests } = api(await credential(), JSON.stringify(policy), meta);
    await expect(github.pullRequest(url)).rejects.toMatchObject({ code: 'invalid_pr_metadata' });
    expect(requests.length).toBe(1);
  }
});
test('HTTP and oversized responses do not become missing evidence', async () => {
  for (const [response, code] of [[new Response('', { status: 404 }), 'github_pr_unavailable'],
    [new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }), 'github_rate_limited'],
    [new Response('', { status: 500 }), 'github_unavailable'],
    [new Response('x'.repeat(1_048_577)), 'github_response_too_large'],
    [new Response('{'), 'github_response_invalid']] as const) {
    const github = new GitHubReader(async () => response);
    await expect(github.pullRequest(url)).rejects.toMatchObject({ code });
  }
});
test('content decoding rejects unsupported types, oversized files, and corrupt bytes', async () => {
  for (const data of [{ ...encoded('{}'), type: 'symlink' }, { ...encoded('{}'), size: 4097 },
    { ...encoded('{}'), size: 1 }, { ...encoded('{}'), content: '??' },
    { type: 'file', encoding: 'base64', size: 1, content: '/w==' }]) {
    const github = new GitHubReader(async () => Response.json(data));
    await expect(github.file('maintainer/repo', '.devouch/vouches/github-12345.json', head, 4096))
      .rejects.toMatchObject({ code: 'github_file_invalid' });
  }
});
test('GitHub file decoding preserves UTF-8 bytes, whitespace, and BOM for strict verification', async () => {
  for (const raw of ['{ "note": "推薦" }\n', '\ufeff{}']) {
    const github = new GitHubReader(async () => Response.json(encoded(raw)));
    expect(await github.file('maintainer/repo', '.devouch/policy.json', base, 16384)).toBe(raw);
  }
});
test('a cancelled read never starts chain verification', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await verifyPullRequest(url, { inspect: async () => { calls++; return proof(); } }, api(await credential()).github, controller.signal);
  expect(calls).toBe(0);
});
