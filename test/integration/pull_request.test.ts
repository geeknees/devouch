// ABOUTME: Exercises public-PR verification and mode switching against real local ENS history.
// ABOUTME: Stubs GitHub reads and optional ENS names while preserving signature and chain verification.
import { expect, test } from 'bun:test';
import { chromium, expect as browserExpect } from '@playwright/test';
import { encodeAbiParameters, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { ChainReader } from '../../src/chain';
import { domain, typedData, validateMessage } from '../../src/credential';
import { RESOLVER_IMPL, setTextData } from '../../src/ens';
import { setupEvm, settle, publicClient, issuer, wallet, testRpc } from '../support/evm';

test('a PR link checks its author and actual base policy without a wallet', async () => {
  const fixture = await setupEvm(); await settle();
  const prepared = await new ChainReader(testRpc).prepare(fixture.name, issuer.address);
  const now = (await publicClient.getBlock()).timestamp;
  const message = validateMessage({ version: '1', id: `0x${'a3'.repeat(32)}`, requestNonce: `0x${'a4'.repeat(32)}`,
    issuer: issuer.address, subject: 'github:12345', scope: 'oss-contribution', issuedAt: now.toString(),
    expiresAt: (now + 3600n).toString(), recordName: fixture.name, resolver: fixture.resolver,
    recordId: prepared.record_id, anchorStartBlock: prepared.anchor_start_block });
  const raw = JSON.stringify({ formatVersion: 1, domain: domain(message), endorsement: {
    message, signature: await issuer.signTypedData(typedData(message)) } });
  const hash = await wallet.sendTransaction({ to: fixture.resolver, data: setTextData(fixture.name, raw) });
  await publicClient.waitForTransactionReceipt({ hash }); await settle();
  const prUrl = 'https://github.com/maintainer/repo/pull/7', base = 'a'.repeat(40), head = 'b'.repeat(40);
  const policy = { repositoryId: 'maintainer/repo', chainId: 11155111, trustedIssuers: [issuer.address],
    allowedScopes: ['oss-contribution'], allowedResolvers: [{ address: fixture.resolver, implementation: RESOLVER_IMPL }], requiredIssuers: 1 };
  const site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  const url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  if (!url) { site.kill(); throw new Error('Static site did not start'); }
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [], forbidden: string[] = [], reads: string[] = [], methods = new Set<string>();
    let mode: 'valid' | 'rejected' | 'missing' | 'mismatch' | 'policy_missing' | 'rate' | 'hold' = 'valid';
    let rpcCalls = 0, release = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(), target = new URL(request.url());
      if (target.origin === url) return route.continue();
      if (target.origin === 'https://api.github.com') {
        const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET',
          'access-control-allow-headers': 'accept, x-github-api-version', 'access-control-expose-headers': 'x-ratelimit-remaining' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        reads.push(target.pathname + target.search);
        if (request.method() !== 'GET' || request.headers().authorization) forbidden.push(request.url());
        if (mode === 'rate') return route.fulfill({ status: 403, headers: { ...cors, 'x-ratelimit-remaining': '0' }, json: {} });
        if (target.pathname.includes('/pulls/')) {
          if (mode === 'hold') await held;
          return route.fulfill({ headers: cors, json: { number: 7, user: { login: 'contributor', id: mode === 'mismatch' ? 999 : 12345 },
            base: { sha: base, repo: { full_name: 'maintainer/repo' } },
            head: { sha: head, repo: { full_name: 'contributor/fork' } } } });
        }
        const isPolicy = target.pathname.endsWith('/policy.json');
        if ((isPolicy && mode === 'policy_missing') || (!isPolicy && mode === 'missing')) return route.fulfill({ status: 404, headers: cors, json: {} });
        const content = isPolicy ? JSON.stringify({ ...policy, trustedIssuers: mode === 'rejected' ? [] : policy.trustedIssuers }) : raw;
        return route.fulfill({ headers: cors, json: { type: 'file', encoding: 'base64', size: Buffer.byteLength(content), content: Buffer.from(content).toString('base64') } });
      }
      if (target.origin !== 'https://sepolia.gateway.tenderly.co') { forbidden.push(request.url()); return route.abort(); }
      const input = request.postDataJSON(); methods.add(input.method); rpcCalls++;
      if (input.method === 'eth_call' && input.params[0].to.toLowerCase() === sepolia.contracts.ensUniversalResolver.address.toLowerCase()) {
        return route.fulfill({ json: { jsonrpc: '2.0', id: input.id, result: encodeAbiParameters(
          [{ type: 'string' }, { type: 'address' }, { type: 'address' }], ['issuer-primary.eth', zeroAddress, zeroAddress]) } });
      }
      const response = await fetch(testRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: request.postData()! });
      return route.fulfill({ json: await response.json() });
    });
    await page.goto(url + '/?pr=' + encodeURIComponent(prUrl) + '#verify');
    await browserExpect(page.locator('#verify-pr-view')).toBeVisible({ timeout: 1500 });
    await browserExpect(page.locator('#verify-pr-evidence-status')).toHaveText('valid');
    await browserExpect(page.locator('#verify-pr-policy-status')).toHaveText('accepted');
    await browserExpect(page.locator('#verify-pr-vouched-by')).toHaveText('Vouched by issuer-primary.eth');
    await browserExpect(page.locator('#verify-pr-author')).toHaveText('@contributor · github:12345');
    await browserExpect(page.locator('#verify-pr-subject-match')).toHaveText('matches PR author');
    await browserExpect(page.locator('#verify-pr-base-sha')).toHaveText(base);
    await browserExpect(page.locator('#verify-pr-head-sha')).toHaveText(head);
    await browserExpect(page.locator('#verify-pr-submit')).toBeEnabled();
    await browserExpect(page.locator('#connect')).toBeHidden();
    expect(await page.evaluate(() => typeof window.ethereum)).toBe('undefined');
    expect(reads).toEqual(['/repos/maintainer/repo/pulls/7',
      `/repos/maintainer/repo/contents/.devouch/policy.json?ref=${base}`,
      `/repos/contributor/fork/contents/.devouch/vouches/github-12345.json?ref=${head}`]);
    expect(await page.locator('#verify-pr-share-url').inputValue()).toBe(url + '/?pr=' + encodeURIComponent(prUrl) + '#verify');
    expect(await page.locator('#verify-pr-policy-source').getAttribute('href')).toContain(`/blob/${base}/.devouch/policy.json`);
    for (const theme of ['dark', 'light']) {
      if (theme === 'light') await page.getByRole('button', { name: 'Switch to light mode' }).click();
      for (const width of [320, 390, 600, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), theme + ' / ' + width).toBe(true);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    mode = 'rejected'; await page.locator('#verify-pr-submit').click();
    await browserExpect(page.locator('#verify-pr-evidence-status')).toHaveText('valid');
    await browserExpect(page.locator('#verify-pr-policy-status')).toHaveText('rejected');
    await browserExpect(page.locator('#verify-pr-policy-reasons')).toContainText('issuer_not_trusted');
    await browserExpect(page.locator('#verify-pr-submit')).toBeEnabled();
    const callsBeforeMismatch = rpcCalls;
    mode = 'mismatch'; await page.locator('#verify-pr-submit').click();
    await browserExpect(page.locator('#verify-pr-evidence-status')).toHaveText('invalid');
    await browserExpect(page.locator('#verify-pr-subject-match')).toHaveText('does not match PR author');
    await browserExpect(page.locator('#verify-pr-policy-reasons')).toContainText('subject_mismatch');
    await browserExpect(page.locator('#verify-pr-submit')).toBeEnabled();
    expect(rpcCalls).toBe(callsBeforeMismatch);
    mode = 'missing'; await page.locator('#verify-pr-submit').click();
    await browserExpect(page.locator('#verify-pr-evidence-status')).toHaveText('missing');
    await browserExpect(page.locator('#verify-pr-policy-status')).toHaveText('not_evaluated');
    await browserExpect(page.locator('#verify-pr-record')).toBeHidden();
    for (const failing of ['policy_missing', 'rate'] as const) {
      mode = failing; await page.locator('#verify-pr-submit').click();
      await browserExpect(page.locator('#verify-pr-status')).toContainText(failing === 'rate' ? 'github_rate_limited' : failing);
      await browserExpect(page.locator('#verify-pr-result')).toBeHidden();
      await browserExpect(page.locator('#verify-pr-share')).toBeHidden();
    }
    mode = 'hold'; await page.locator('#verify-pr-submit').click();
    await browserExpect(page.locator('#verify-pr-submit')).toBeDisabled();
    await page.locator('[data-verify-mode="name"]').click(); release();
    await browserExpect(page.locator('#verify-name-view')).toBeVisible();
    await page.locator('#verify-name').fill(fixture.name);
    await page.locator('#verify-submit').click();
    await browserExpect(page.locator('#verify-policy-a-status')).toHaveText('accepted');
    await browserExpect(page.locator('#verify-submit')).toBeEnabled();
    expect(new URL(page.url()).searchParams.has('pr')).toBe(false);
    await page.locator('[data-verify-mode="pr"]').click();
    await browserExpect(page.locator('#verify-pr-result')).toBeHidden();
    mode = 'valid';
    const withdrawn = await wallet.sendTransaction({ to: fixture.resolver, data: setTextData(fixture.name, '') });
    await publicClient.waitForTransactionReceipt({ hash: withdrawn }); await settle();
    await page.locator('#verify-pr-submit').click();
    await browserExpect(page.locator('#verify-pr-evidence-status')).toHaveText('revoked');
    await browserExpect(page.locator('#verify-pr-signature-status')).toHaveText('valid');
    await browserExpect(page.locator('#verify-pr-policy-status')).toHaveText('not_evaluated');
    await browserExpect(page.locator('#verify-pr-submit')).toBeEnabled();
    await page.locator('#verify-pr-url').fill('https://github.com/maintainer/repo/pull/8');
    await browserExpect(page.locator('#verify-pr-result')).toBeHidden();
    await browserExpect(page.locator('#verify-pr-share')).toBeHidden();
    expect([...methods].every(method => !/send|sign|Accounts/.test(method))).toBe(true);
    expect(forbidden).toEqual([]); expect(errors).toEqual([]);
  } finally { await browser.close(); site.kill(); await site.exited; }
}, 120000);
