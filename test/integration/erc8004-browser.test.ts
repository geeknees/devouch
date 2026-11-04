// ABOUTME: Drives the shipped ERC-8004 workspace against real local registry bytecode in Chromium.
// ABOUTME: Covers wallet consent, uncertain delivery recovery, file verification, and evaluator withdrawal without external services.
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chromium, expect as browserExpect, type Browser } from '@playwright/test';
import type { Subprocess } from 'bun';
import { setupErc8004 } from '../support/erc8004';
let browser: Browser, site: Subprocess<'ignore', 'pipe', 'pipe'>, url: string;
beforeAll(async () => {
  site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] ?? '';
  if (!url) throw new Error('Static fixture did not start');
  browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
}, 30000);
afterAll(async () => { await browser?.close(); site?.kill(); if (site) await site.exited; });

test('unknown publication delivery survives reload and exact recovery precedes download, verification, and withdrawal', async () => {
  const f = await setupErc8004(process.env.DEVOUCH_TEST_RPC!, false), page = await browser.newPage();
  let sends = 0, sentHash = '', loseResponse = true, estimateFails = true;
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    if ([url, process.env.DEVOUCH_TEST_RPC].includes(new URL(route.request().url()).origin)) await route.continue();
    else { external.push(route.request().url()); await route.abort(); }
  });
  await page.exposeFunction('testWalletRequest', async (request: { method: string; params?: unknown[] }) => {
    if (request.method === 'eth_requestAccounts' || request.method === 'eth_accounts') return [f.evaluator];
    if (request.method === 'eth_estimateGas' && estimateFails) throw new Error('fixture estimate unavailable');
    const result = await f.rpc(request.method, request.params);
    if (request.method === 'eth_sendTransaction') {
      sends++; sentHash = String(result);
      if (loseResponse) throw new Error('fixture lost wallet response');
    }
    return result;
  });
  await page.addInitScript(() => {
    const w = window as unknown as { ethereum: unknown; testWalletRequest: (request: unknown) => Promise<unknown> };
    w.ethereum = { request: (request: unknown) => w.testWalletRequest(request), on() {}, removeListener() {} };
  });
  const upload = (data: unknown) => ({ name: 'public.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  const selectRpc = async () => {
    await page.locator('.rpc-settings summary').click();
    await page.locator('#rpc-url').fill(process.env.DEVOUCH_TEST_RPC!);
    await page.getByRole('button', { name: 'Use endpoint' }).click();
    await browserExpect(page.locator('#status')).toContainText('RPC endpoint selected');
  };
  try {
    await page.goto(url); await selectRpc();
    await page.locator('#deployment-file').setInputFiles(upload({ format: 'devouch-erc8004-deployment-v1', chainId: 11155111, registry: f.policy.allowedRegistries[0] }));
    await browserExpect(page.locator('#status')).toContainText('Deployment selected');
    await page.locator('#agent-id').fill('0'); await page.locator('#subject-id').fill('12345');
    await page.getByRole('button', { name: 'Prepare recommendation' }).click();
    await browserExpect(page.locator('#review')).toBeVisible();
    await browserExpect(page.locator('#send')).toBeDisabled(); expect(sends).toBe(0);
    await page.locator('#consent').check(); await page.locator('#send').click();
    await browserExpect(page.locator('#status')).toContainText('The wallet could not estimate gas. No transaction was sent.');
    await browserExpect(page.locator('#pending-panel')).toBeHidden(); expect(sends).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('devouch.erc8004.pending.v1'))).toBeNull();
    estimateFails = false; await page.locator('#send').click();
    await browserExpect(page.locator('#status')).toContainText('submission unknown');
    await browserExpect(page.locator('#pending-panel')).toBeVisible(); expect(sends).toBe(1);
    await page.reload(); await browserExpect(page.locator('#pending-panel')).toBeVisible(); await selectRpc();
    await page.locator('#recovery-hash').fill('0x' + '11'.repeat(32)); await page.locator('#recover').click();
    await browserExpect(page.locator('#status')).toContainText('pending transaction');
    await browserExpect(page.locator('#pending-panel')).toBeVisible(); expect(sends).toBe(1);
    await page.locator('#recovery-hash').fill(sentHash); await page.locator('#recover').click();
    await browserExpect(page.locator('#status')).toContainText('exact state read back');
    await browserExpect(page.locator('#pending-panel')).toBeHidden();
    const download = page.waitForEvent('download'); await page.locator('#download-reference').click();
    const filePath = await (await download).path(); expect(filePath).toBeTruthy();
    const reference = await Bun.file(filePath!).json(); expect(reference.feedbackIndex).toBe('2');
    await page.locator('[data-tab="verify"]').click();
    await page.locator('#panel-verify details summary').click();
    await page.locator('#verify-subject').fill('12345');
    await page.locator('#verify-reference').setInputFiles(upload(reference));
    await page.locator('#verify-policy').setInputFiles(upload(f.policy));
    await page.getByRole('button', { name: 'Verify files' }).click();
    await browserExpect(page.locator('#status')).toContainText('Evidence: valid / Policy: accepted');
    await page.locator('#deployment-file').setInputFiles(upload({ format: 'devouch-erc8004-deployment-v1', chainId: 11155111, registry: f.policy.allowedRegistries[0] }));
    await browserExpect(page.locator('#status')).toContainText('Deployment selected');
    await page.locator('[data-tab="revoke"]').click();
    await page.locator('#revoke-file').setInputFiles(upload(reference));
    await browserExpect(page.locator('#review')).toBeVisible();
    await browserExpect(page.locator('#review-details')).toContainText('revoke');
    loseResponse = false; await page.locator('#consent').check(); await page.locator('#send').click();
    await browserExpect(page.locator('#status')).toContainText('Transaction submitted');
    await page.locator('#recover').click();
    await browserExpect(page.locator('#status')).toContainText('exact state read back');
    expect(sends).toBe(2);
    await page.locator('[data-tab="verify"]').click(); await page.getByRole('button', { name: 'Verify files' }).click();
    await browserExpect(page.locator('#status')).toContainText('Evidence: revoked / Policy: not_evaluated');
    expect(errors).toEqual([]); expect(external).toEqual([]);
  } finally { await page.close(); }
}, 30000);
