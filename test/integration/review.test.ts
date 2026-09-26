// ABOUTME: Checks that wallet consent always describes the endorsement visible in the form.
// ABOUTME: Exercises request replacement, edited inputs, and cancelled signatures in a real browser.
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chromium, expect as browserExpect, type Browser, type Page } from '@playwright/test';
import type { Subprocess } from 'bun';
import { ChainReader } from '../../src/chain';
import { makeRequest, type PublishRequest } from '../../src/operations';
import { issuer, rpc, setupEvm, settle, testRpc } from '../support/evm';

let browser: Browser, site: Subprocess<'ignore', 'pipe', 'pipe'>, url: string, request: PublishRequest;
beforeAll(async () => {
  const fixture = await setupEvm();
  await settle();
  request = await makeRequest({ name: fixture.name, issuer: issuer.address, subject: 'github:287365775',
    expiresAt: String(Math.floor(Date.now() / 60000) * 60 + 86437) }, new ChainReader(testRpc));
  site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] ?? '';
  if (!url) throw new Error('Static test site did not start');
  browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
}, 30000);
afterAll(async () => { await browser?.close(); site?.kill(); if (site) await site.exited; });

async function loadRequest(page: Page, contents = JSON.stringify(request)) {
  await page.locator('#request-file').setInputFiles({ name: 'request.json', mimeType: 'application/json', buffer: Buffer.from(contents) });
}

test.each([
  ['publish-name', 'another-name.eth'], ['subject-id', '701242'], ['expires', '2026-10-03T12:00'],
])('editing %s requires a fresh review and consent', async (field, value) => {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    await loadRequest(page);
    await browserExpect(page.locator('#review')).toBeVisible();
    await browserExpect(page.locator('#publish-name')).toHaveValue(request.message.recordName);
    await browserExpect(page.locator('#subject-id')).toHaveValue('287365775');
    expect(await page.locator('#expires').evaluate((input: HTMLInputElement) => new Date(input.value).getTime() / 1000))
      .toBe(Number(request.message.expiresAt));
    await page.locator('#consent').check();
    await page.locator('#' + field).fill(value!);
    await browserExpect(page.locator('#review')).toBeHidden();
    await browserExpect(page.locator('#sign')).toBeDisabled();
    await browserExpect(page.locator('#publish')).toBeDisabled();
    await browserExpect(page.locator('#consent')).not.toBeChecked();
    await browserExpect(page.locator('#status')).toContainText('Prepare');
  } finally { await page.close(); }
}, 15000);

test('a failed replacement file cannot leave the previous request available for signing', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    await loadRequest(page);
    await browserExpect(page.locator('#review')).toBeVisible();
    await page.locator('#consent').check();
    await loadRequest(page, '{"operation":"publish"}');
    await browserExpect(page.locator('#status')).toContainText('not a valid');
    await browserExpect(page.locator('#review')).toBeHidden();
    await browserExpect(page.locator('#sign')).toBeDisabled();
    await browserExpect(page.locator('#publish')).toBeDisabled();
    await browserExpect(page.locator('#consent')).not.toBeChecked();
  } finally { await page.close(); }
}, 15000);

test('signature cancellation unlocks the form and editing a signed request prevents publication', async () => {
  const context = await browser.newContext();
  let signatureRequests = 0, transactionRequests = 0;
  let releaseSignature: () => void = () => {};
  const signatureGate = new Promise<void>(resolve => { releaseSignature = resolve; });
  try {
    await context.exposeBinding('testWalletRequest', async (_source, input: { method: string; params?: unknown[] }) => {
      const params = input.params ?? [];
      if (input.method === 'eth_requestAccounts' || input.method === 'eth_accounts') return { result: [issuer.address] };
      if (input.method === 'eth_signTypedData_v4') {
        signatureRequests++;
        if (signatureRequests === 1) {
          await signatureGate;
          return { error: { code: 4001, message: 'Cancelled by test user' } };
        }
        return { result: await issuer.signTypedData(JSON.parse(params[1] as string)) };
      }
      if (input.method === 'eth_sendTransaction') {
        transactionRequests++;
        return { error: { code: 4001, message: 'Unexpected transaction request' } };
      }
      return { result: await rpc(input.method, params) };
    });
    await context.addInitScript(() => {
      const target = window as unknown as { ethereum: unknown; testWalletRequest: (input: unknown) => Promise<{
        result?: unknown; error?: { code: number; message: string } }> };
      target.ethereum = { on() {}, async request(input: unknown) {
        const response = await target.testWalletRequest(input);
        if (response.error) throw Object.assign(new Error(response.error.message), { code: response.error.code });
        return response.result;
      } };
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('.rpc-settings summary').click();
    await page.locator('#rpc-url').fill(testRpc);
    await page.locator('#apply-rpc').click();
    await browserExpect(page.locator('#status')).toContainText('Sepolia connection checked');
    await loadRequest(page);
    await browserExpect(page.locator('#review')).toBeVisible();
    await page.locator('#consent').check();
    await page.locator('#sign').click();
    await browserExpect.poll(() => signatureRequests).toBe(1);
    for (const id of ['publish-name', 'subject-id', 'expires', 'consent', 'request-file']) {
      await browserExpect(page.locator('#' + id)).toBeDisabled();
    }
    releaseSignature();
    await browserExpect(page.locator('#status')).toContainText('cancelled');
    await browserExpect(page.locator('#sign')).toBeEnabled();
    await browserExpect(page.locator('#publish')).toBeDisabled();
    await browserExpect(page.locator('#subject-id')).toBeEnabled();
    await page.locator('#sign').click();
    await browserExpect(page.locator('#status')).toContainText('Signature checked');
    await browserExpect(page.locator('#publish')).toBeEnabled();
    await page.locator('#subject-id').fill('701242');
    await browserExpect(page.locator('#publish')).toBeDisabled();
    await browserExpect(page.locator('#review')).toBeHidden();
    expect(signatureRequests).toBe(2);
    expect(transactionRequests).toBe(0);
  } finally { releaseSignature(); await context.close(); }
}, 30000);
