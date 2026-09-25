// ABOUTME: Exercises the real static UI with an injected test wallet and official ENS contracts.
// ABOUTME: Covers consent, cancellation, publication, withdrawal, recovery, and mobile overflow.
import { expect, test } from 'bun:test';
import { chromium, expect as browserExpect } from '@playwright/test';
import type { Address, Hex } from 'viem';
import { ChainReader } from '../../src/chain';
import { parseCredential } from '../../src/credential';
import { issuer, wallet, setupEvm, settle, testRpc, rpc } from '../support/evm';

test('wallet UI handles rejection and unknown submission without losing the public operation', async () => {
  const fixture = await setupEvm();
  await settle();
  const site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  const url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  if (!url) { site.kill(); throw new Error('Static test site did not start'); }
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    let disposition: 'reject' | 'unknown' | 'send' = 'reject';
    let lastHash: Hex | undefined;
    let signatureRequests = 0, transactionRequests = 0;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
    await context.exposeBinding('testWalletRequest', async (_source, input: { method: string; params?: unknown[] }) => {
      try {
        const params = input.params ?? [];
        if (input.method === 'eth_requestAccounts' || input.method === 'eth_accounts') return { result: [issuer.address] };
        if (input.method === 'eth_signTypedData_v4') {
          signatureRequests++;
          return { result: await issuer.signTypedData(JSON.parse(params[1] as string)) };
        }
        if (input.method === 'eth_sendTransaction') {
          transactionRequests++;
          if (disposition === 'reject') return { error: { code: 4001, message: 'Cancelled by test user' } };
          const tx = params[0] as { to: Address; data: Hex };
          lastHash = await wallet.sendTransaction({ to: tx.to, data: tx.data });
          await settle();
          if (disposition === 'unknown') return { error: { code: -32000, message: 'Response lost after delivery' } };
          return { result: lastHash };
        }
        return { result: await rpc(input.method, params) };
      } catch { return { error: { code: -32000, message: 'Test wallet failed' } }; }
    });
    await context.addInitScript(() => {
      const pageWindow = window as unknown as { ethereum: unknown; testWalletRequest: (input: unknown) => Promise<{ error?: { message: string; code: number }; result?: unknown }> };
      pageWindow.ethereum = { on() {}, async request(input: unknown) {
        const output = await pageWindow.testWalletRequest(input);
        if (output.error) throw Object.assign(new Error(output.error.message), { code: output.error.code });
        return output.result;
      } };
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(url);
    await page.screenshot({ path: '/tmp/devouch-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/devouch-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1080 });
    const connectRpc = async () => {
      await page.locator('.rpc-settings summary').click();
      await page.locator('#rpc-url').fill(testRpc);
      await page.locator('#apply-rpc').click();
      await browserExpect(page.locator('#status')).toContainText('Sepolia connection checked');
    };
    await connectRpc();
    await page.locator('#connect').click();
    await page.locator('#publish-name').fill(fixture.name);
    await page.locator('#prepare').click();
    await browserExpect(page.locator('#review')).toBeVisible();
    await browserExpect(page.locator('#sign')).toBeDisabled();
    expect(signatureRequests).toBe(0);
    expect(transactionRequests).toBe(0);
    await page.locator('#consent').check();
    await page.locator('#sign').click();
    await browserExpect(page.locator('#status')).toContainText('Signature checked');
    expect(signatureRequests).toBe(1);
    expect(transactionRequests).toBe(0);
    await page.locator('#publish').click();
    await browserExpect(page.locator('#status')).toContainText('cancelled');
    await browserExpect(page.locator('#pending-panel')).toBeHidden();
    disposition = 'unknown';
    await page.locator('#publish').click();
    await browserExpect(page.locator('#status')).toContainText('outcome is unknown');
    await browserExpect(page.locator('#pending-panel')).toBeVisible();
    await browserExpect(page.locator('#publish')).toBeDisabled();
    await page.reload();
    await browserExpect(page.locator('#pending-panel')).toBeVisible();
    await connectRpc();
    await page.locator('#recovery-hash').fill(lastHash!);
    await page.locator('#recover').click();
    await browserExpect(page.locator('#downloads')).toBeVisible();
    await browserExpect(page.locator('#pending-panel')).toBeHidden();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-vouch').click();
    const downloaded = await downloadPromise;
    const raw = await Bun.file((await downloaded.path())!).text();
    expect((await parseCredential(raw)).message.subject).toBe('github:287365775');
    expect((await new ChainReader(testRpc).inspect(await parseCredential(raw))).evidence_status).toBe('valid');
    disposition = 'send';
    await page.locator('[data-tab="revoke"]').click();
    await page.locator('#revoke-file').setInputFiles({ name: 'vouch.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
    await browserExpect(page.locator('#revoke-review')).toBeVisible();
    await page.locator('#revoke-consent').check();
    await page.locator('#revoke').click();
    await browserExpect(page.locator('#status')).toContainText('Withdrawn');
    expect((await new ChainReader(testRpc).inspect(await parseCredential(raw))).evidence_status).toBe('revoked');
    expect(pageErrors).toEqual([]);
  } finally { await browser.close(); site.kill(); await site.exited; }
}, 120000);
