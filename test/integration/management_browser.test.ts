// ABOUTME: Exercises saved recommendations and RPC diagnostics through the built mobile workspace.
// ABOUTME: Uses real ENS verification and withdrawal, with explicit provider failures and no browser wallet.
import { expect, test } from 'bun:test';
import { chromium, expect as browserExpect } from '@playwright/test';
import { namehash, type Address, type EIP1193Provider, type Hex } from 'viem';
import { ChainReader } from '../../src/chain';
import { setTextData } from '../../src/ens';
import { SAVED_NAMES_KEY } from '../../src/endorsement-list';
import { Submission } from '../../web/submission';
import { WalletSession } from '../../web/wallet';
import { issueLeaf } from '../support/hierarchy';
import { setupEvm, settle, publicClient, wallet, issuer, rpc, testRpc } from '../support/evm';

test('saved names refresh full evidence, recover withdrawal, and diagnose failures without changing connections', async () => {
  const fixture = await setupEvm(); await settle();
  await issueLeaf({ ...fixture, node: namehash(fixture.name), subject: 'github:287365775' });
  const agentFixture = await setupEvm(); await settle();
  const provider = { async request({ method, params }: { method: string; params?: unknown[] }) {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [issuer.address];
    if (method === 'eth_sendTransaction') {
      const hash = await wallet.sendTransaction(params![0] as { to: Address; data: Hex });
      await publicClient.waitForTransactionReceipt({ hash }); await settle(); return hash;
    }
    return rpc(method, params);
  } } as EIP1193Provider;
  const session = new WalletSession(testRpc, provider, new Submission(() => {}));
  await session.connect();
  const agentAddress = '0x1111111111111111111111111111111111111111';
  const deployed = await session.deploy(agentFixture.name, { subject: 'github:701242', wallet: agentAddress });
  await session.bind(agentFixture.name, deployed.resolver!);
  await session.agentPermission(agentFixture.name, agentAddress, 'description', true);
  const site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  const url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  if (!url) { site.kill(); throw new Error('Static test site did not start'); }
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [], methods = new Set<string>();
    page.on('pageerror', error => errors.push(error.message));
    let unavailable = false, rateLimit = false, alternateCalls = 0;
    await page.route('**/*', async route => {
      const request = route.request();
      if (new URL(request.url()).origin === url) return route.continue();
      if (![testRpc, 'https://sepolia.gateway.tenderly.co'].includes(new URL(request.url()).origin)) return route.abort();
      if (new URL(request.url()).origin === testRpc) alternateCalls++;
      const input = request.postDataJSON(); methods.add(input.method);
      if (unavailable || rateLimit) return route.fulfill({ json: { jsonrpc: '2.0', id: input.id,
        error: { code: rateLimit ? -32005 : -32000, message: rateLimit ? 'rate limit secret.test/key' : 'Provider unavailable' } } });
      const response = await fetch(testRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: request.postData()! });
      return route.fulfill({ json: await response.json() });
    });
    await page.goto(url + '/#manage');
    await browserExpect(page.locator('#panel-manage')).toBeVisible();
    await browserExpect(page.locator('#connect')).toBeHidden();
    await page.locator('#manage-name').fill(fixture.name);
    await page.locator('#manage-add').click();
    const row = page.locator('[data-saved-name]').first();
    await browserExpect(row.locator('[data-evidence-state]')).toHaveText('not_checked');
    await row.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
    await browserExpect(row.locator('[data-evidence-state]')).toHaveText('valid', { timeout: 30000 });
    await browserExpect(row).toContainText('github:287365775');
    await browserExpect(row).toContainText('oss-contribution');
    await browserExpect(row).toContainText('not_evaluated');
    await row.getByRole('button', { name: 'Check agent permissions' }).click();
    await browserExpect(row.locator('[data-agent-result]')).toContainText('No controller-declared agent identity');
    await browserExpect(row.locator('[data-evidence-state]')).toHaveText('valid');
    await page.locator('#manage-name').fill(agentFixture.name);
    await page.locator('#manage-add').click();
    const agentRow = page.locator('[data-saved-name]').nth(1);
    await agentRow.getByRole('button', { name: 'Check agent permissions' }).click();
    await browserExpect(agentRow.locator('[data-agent-result]')).toContainText('description');
    await browserExpect(agentRow.locator('[data-agent-result]')).toContainText('github:701242');
    await browserExpect(agentRow.locator('[data-evidence-state]')).toHaveText('not_checked');
    await session.agentPermission(agentFixture.name, agentAddress, 'description', false);
    await agentRow.getByRole('button', { name: 'Check agent permissions' }).click();
    await browserExpect(agentRow.locator('[data-agent-result]')).toContainText('None');
    await agentRow.getByRole('button', { name: 'Remove from list' }).click();
    const saved = await page.evaluate(key => localStorage.getItem(key), SAVED_NAMES_KEY);
    expect(JSON.parse(saved!).names[0].publication).toBeDefined();
    expect(saved).not.toContain('evidence_status');
    await page.reload();
    await browserExpect(row.locator('[data-evidence-state]')).toHaveText('not_checked');
    const hash = await wallet.sendTransaction({ to: fixture.resolver, data: setTextData(fixture.name, '') });
    await publicClient.waitForTransactionReceipt({ hash }); await settle();
    await row.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
    await browserExpect(row.locator('[data-evidence-state]')).toHaveText('revoked', { timeout: 30000 });
    await browserExpect(row).toContainText('Saved publication');
    expect(new URL((await row.getByRole('link', { name: 'Verify & compare' }).getAttribute('href'))!).searchParams.has('publication')).toBe(true);
    unavailable = true;
    await row.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
    await browserExpect(row.locator('[data-evidence-state]')).toHaveText('unavailable');
    await browserExpect(row).not.toContainText('github:287365775');
    await page.locator('.rpc-settings summary').click();
    await page.locator('#rpc-url').fill(testRpc);
    rateLimit = true;
    await page.locator('#diagnose-rpc').click();
    await browserExpect(page.locator('#rpc-diagnostics')).toContainText('rate_limited');
    await browserExpect(page.locator('#rpc-diagnostics')).not.toContainText('secret.test');
    expect(alternateCalls).toBeGreaterThan(0);
    const beforeRefresh = alternateCalls;
    rateLimit = false; unavailable = false;
    await row.getByRole('button', { name: 'Refresh evidence', exact: true }).click();
    await browserExpect(row.locator('[data-evidence-state]')).toHaveText('revoked', { timeout: 30000 });
    expect(alternateCalls).toBe(beforeRefresh);
    await page.locator('#apply-rpc').click();
    await browserExpect(page.locator('#status')).toContainText('Sepolia connection checked');
    await browserExpect(row.locator('[data-evidence-state]')).toHaveText('not_checked');
    await page.locator('#diagnose-rpc').click();
    await browserExpect(page.locator('#rpc-diagnostics')).toContainText('historical_code_mismatch');
    await browserExpect(page.locator('#rpc-diagnostics')).toContainText('Historical event logs');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'manage at ' + width).toBe(true);
    }
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await row.getByRole('button', { name: 'Remove from list' }).click();
    await browserExpect(page.locator('[data-saved-name]')).toHaveCount(0);
    expect((await new ChainReader(testRpc).verifyName(fixture.name, JSON.parse(saved!).names[0].publication)).evidence.evidence_status).toBe('revoked');
    expect([...methods].some(method => /send|sign|requestAccounts/.test(method))).toBe(false);
    expect(await page.evaluate(() => typeof window.ethereum)).toBe('undefined');
    await page.evaluate(key => localStorage.setItem(key, '{broken'), SAVED_NAMES_KEY);
    await page.reload();
    await browserExpect(page.locator('#manage-storage')).toContainText('existing saved data is preserved');
    await page.locator('#manage-name').fill(fixture.name);
    await page.locator('#manage-add').click();
    expect(await page.evaluate(key => localStorage.getItem(key), SAVED_NAMES_KEY)).toBe('{broken');
    expect(errors).toEqual([]);
  } finally { await browser.close(); site.kill(); await site.exited; }
}, 120000);
