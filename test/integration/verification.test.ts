// ABOUTME: Exercises wallet-free verification and editable repository policies in the built mobile UI.
// ABOUTME: Uses real local ENS history, mocking only optional primary-name responses from the Universal Resolver.
import { expect, test } from 'bun:test';
import { chromium, expect as browserExpect } from '@playwright/test';
import { encodeAbiParameters, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { ChainReader } from '../../src/chain';
import { domain, typedData, validateMessage } from '../../src/credential';
import { setTextData } from '../../src/ens';
import { setupEvm, settle, publicClient, issuer, wallet, testRpc } from '../support/evm';

test('a shared mobile URL verifies once and compares two policies without a wallet', async () => {
  const fixture = await setupEvm();
  await settle();
  const prepared = await new ChainReader(testRpc).prepare(fixture.name, issuer.address);
  const latest = await publicClient.getBlock();
  const message = validateMessage({ version: '1', id: `0x${'91'.repeat(32)}`, requestNonce: `0x${'92'.repeat(32)}`,
    issuer: issuer.address, subject: 'github:287365775', scope: 'oss-contribution',
    issuedAt: latest.timestamp.toString(), expiresAt: (latest.timestamp + 3600n).toString(),
    recordName: fixture.name, resolver: fixture.resolver, recordId: prepared.record_id, anchorStartBlock: prepared.anchor_start_block });
  const raw = JSON.stringify({ formatVersion: 1, domain: domain(message), endorsement: {
    message, signature: await issuer.signTypedData(typedData(message)) } });
  const hash = await wallet.sendTransaction({ to: fixture.resolver, data: setTextData(fixture.name, raw) });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const hint = { chainId: 11155111, transactionHash: hash, blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash };
  await settle();
  const site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  const url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  if (!url) { site.kill(); throw new Error('Static test site did not start'); }
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let nameMode: 'name' | 'absent' | 'failure' = 'name', rpcFailed = false;
    let calls = 0;
    const errors: string[] = [], external: string[] = [], methods = new Set<string>();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request();
      if (new URL(request.url()).origin === url) return route.continue();
      if (new URL(request.url()).origin !== 'https://sepolia.gateway.tenderly.co') {
        external.push(request.url()); return route.abort();
      }
      const input = request.postDataJSON(); calls++; methods.add(input.method);
      const isNameLookup = input.method === 'eth_call' && input.params[0].to.toLowerCase()
        === sepolia.contracts.ensUniversalResolver.address.toLowerCase();
      if (rpcFailed || (isNameLookup && nameMode === 'failure')) return route.fulfill({ json: {
        jsonrpc: '2.0', id: input.id, error: { code: -32000, message: 'Unavailable test provider' } } });
      if (isNameLookup) return route.fulfill({ json: { jsonrpc: '2.0', id: input.id, result: encodeAbiParameters(
        [{ type: 'string' }, { type: 'address' }, { type: 'address' }],
        [nameMode === 'name' ? 'issuer-primary.eth' : '', zeroAddress, zeroAddress]) } });
      const response = await fetch(testRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: request.postData()! });
      return route.fulfill({ json: await response.json() });
    });
    await page.goto(url + '/?name=' + fixture.name + '#verify');
    await browserExpect(page.locator('#panel-verify')).toBeVisible();
    await browserExpect(page.locator('#verify-evidence-status')).toHaveText('valid');
    await browserExpect(page.locator('#verify-signature-status')).toHaveText('valid');
    await browserExpect(page.locator('#verify-vouched-by')).toHaveText('Vouched by issuer-primary.eth');
    await browserExpect(page.locator('#verify-record-name')).toHaveText(fixture.name);
    await browserExpect(page.locator('#verify-issuer-address')).toHaveText(issuer.address);
    await browserExpect(page.locator('#verify-policy-a-status')).toHaveText('accepted');
    await browserExpect(page.locator('#verify-policy-b-status')).toHaveText('rejected');
    await browserExpect(page.locator('#verify-policy-b-reasons')).toContainText('issuer_not_trusted');
    await browserExpect(page.locator('#verify-human')).toHaveText('human verification: not included');
    await browserExpect(page.locator('#connect')).toBeHidden();
    expect(await page.evaluate(() => typeof window.ethereum)).toBe('undefined');
    const checkedBlock = await page.locator('#verify-block').textContent(), checkedCalls = calls;
    const map = page.locator('#verify-trust-map');
    await browserExpect(map).toBeVisible({ timeout: 1500 });
    await browserExpect(map.locator('.trust-map-details')).toBeHidden();
    await browserExpect(map.locator('[data-trust-node="issuer"]')).toContainText('issuer-primary.eth');
    await browserExpect(map.locator('[data-trust-node="publication"]')).toContainText(fixture.name);
    await browserExpect(map.locator('[data-trust-node="endorsement"]')).toHaveAttribute('data-state', 'valid');
    await browserExpect(map.locator('[data-trust-node="policy-a"]')).toHaveAttribute('data-state', 'accepted');
    await browserExpect(map.locator('[data-trust-node="policy-b"]')).toHaveAttribute('data-state', 'rejected');
    await browserExpect(map.locator('[data-trust-edge]')).toHaveCount(4);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await map.locator('[data-trust-node]').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).animationName === 'none'))).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await map.locator('[data-trust-node="issuer"]').focus();
    await page.keyboard.press('Enter');
    await browserExpect(map.locator('.trust-map-details')).toBeVisible();
    await browserExpect(map.locator('.trust-map-details')).toContainText(issuer.address);
    await browserExpect(map.locator('.trust-map-details')).toContainText('Primary ENS name differs from the publication name.');
    await page.keyboard.press('Tab'); await page.keyboard.press('Space');
    await browserExpect(map.locator('[data-trust-node="publication"]')).toHaveAttribute('aria-pressed', 'true');
    await browserExpect(map.locator('.trust-map-details')).toContainText(fixture.resolver);
    await map.locator('[data-trust-node="policy-b"]').click();
    await browserExpect(map.locator('.trust-map-details')).toContainText('issuer_not_trusted');
    await map.getByRole('button', { name: 'Edit trusted issuers' }).click();
    await browserExpect(page.locator('#verify-policy-b-issuers')).toBeFocused();
    await page.locator('#verify-policy-b-issuers').fill(issuer.address);
    await browserExpect(page.locator('#verify-policy-b-status')).toHaveText('accepted');
    await browserExpect(map.locator('[data-trust-node="policy-b"]')).toHaveAttribute('data-state', 'accepted');
    await browserExpect(map.locator('[data-trust-edge="policy-b"]')).toHaveAttribute('data-state', 'accepted');
    await browserExpect(map.locator('.trust-map-details')).not.toContainText('issuer_not_trusted');
    await page.locator('#verify-policy-b-issuers').fill('invalid address');
    await browserExpect(page.locator('#verify-policy-b-status')).toHaveText('not_evaluated');
    await browserExpect(map.locator('[data-trust-node="policy-b"]')).toHaveAttribute('data-state', 'not_evaluated');
    await browserExpect(map.locator('.trust-map-details')).toContainText('invalid_policy');
    await browserExpect(page.locator('#verify-policy-b-reasons')).toContainText('invalid_policy');
    await page.locator('#verify-policy-b-issuers').fill('');
    await page.locator('[data-trust-issuer="b"]').click();
    await browserExpect(page.locator('#verify-policy-b-status')).toHaveText('accepted');
    expect(await page.locator('#verify-block').textContent()).toBe(checkedBlock);
    expect(calls).toBe(checkedCalls);
    for (const width of [320, 390, 600, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'verify at ' + width).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await browserExpect(page.locator('#verify-policy-b-status')).toHaveText('accepted');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#verify-name').fill('another.eth');
    await browserExpect(page.locator('#verify-result')).toBeHidden();
    await browserExpect(map).toBeHidden();
    await page.locator('#verify-name').fill(fixture.name);
    for (const mode of ['absent', 'failure'] as const) {
      nameMode = mode;
      await page.locator('#verify-submit').click();
      await browserExpect(page.locator('#verify-evidence-status')).toHaveText('valid');
      await browserExpect(page.locator('#verify-vouched-by')).toHaveText('Vouched by ' + issuer.address);
      await browserExpect(page.locator('#verify-submit')).toBeEnabled();
      await browserExpect(page.locator('#verify-policy-a-status')).toHaveText('accepted');
      await map.locator('[data-trust-node="issuer"]').click();
      await browserExpect(map.locator('.trust-map-details')).toContainText(issuer.address);
      await browserExpect(map).not.toContainText('issuer-primary.eth');
    }
    rpcFailed = true;
    await page.locator('#verify-submit').click();
    await browserExpect(page.locator('#verify-evidence-status')).toHaveText('unavailable');
    await browserExpect(page.locator('#verify-policy-a-status')).toHaveText('not_evaluated');
    await browserExpect(page.locator('#verify-vouched-by')).toBeHidden();
    await browserExpect(map).toBeHidden();
    rpcFailed = false;
    const revoke = await wallet.sendTransaction({ to: fixture.resolver, data: setTextData(fixture.name, '') });
    await publicClient.waitForTransactionReceipt({ hash: revoke }); await settle();
    await page.goto(url + '/?name=' + fixture.name + '&publication=' + encodeURIComponent(JSON.stringify(hint)) + '#verify');
    await browserExpect(page.locator('#verify-evidence-status')).toHaveText('revoked');
    await browserExpect(page.locator('#verify-signature-status')).toHaveText('valid');
    await browserExpect(page.locator('#verify-policy-a-status')).toHaveText('not_evaluated');
    await browserExpect(page.locator('#verify-policy-b-status')).toHaveText('not_evaluated');
    await browserExpect(map.locator('[data-trust-node="endorsement"]')).toHaveAttribute('data-state', 'revoked');
    await browserExpect(map.locator('[data-trust-node="issuer"]')).toHaveAttribute('data-state', 'valid');
    await browserExpect(map.locator('[data-trust-node="policy-a"]')).toHaveAttribute('data-state', 'not_evaluated');
    expect(await page.locator('#verify-share-link').getAttribute('href')).toContain('publication=');
    await page.goto(url + '/?name=' + fixture.name + '#verify');
    await browserExpect(page.locator('#verify-evidence-status')).toHaveText('missing');
    await browserExpect(map).toBeHidden();
    await browserExpect(page.locator('#verify-policy-a-status')).toHaveText('not_evaluated');
    const now = (await publicClient.getBlock()).timestamp;
    const expiredMessage = { ...message, id: `0x${'93'.repeat(32)}` as const, requestNonce: `0x${'94'.repeat(32)}` as const,
      issuedAt: (now - 100n).toString(), expiresAt: (now - 1n).toString() };
    const expired = { formatVersion: 1, domain: domain(expiredMessage), endorsement: {
      message: expiredMessage, signature: await issuer.signTypedData(typedData(expiredMessage)) } };
    const expiredHash = await wallet.sendTransaction({ to: fixture.resolver, data: setTextData(fixture.name, JSON.stringify(expired)) });
    await publicClient.waitForTransactionReceipt({ hash: expiredHash }); await settle();
    await page.locator('#verify-submit').click();
    await browserExpect(page.locator('#verify-evidence-status')).toHaveText('expired');
    await browserExpect(map.locator('[data-trust-node="endorsement"]')).toHaveAttribute('data-state', 'expired');
    await browserExpect(page.locator('#verify-signature-status')).toHaveText('valid');
    await browserExpect(page.locator('#verify-policy-a-status')).toHaveText('not_evaluated');
    await browserExpect(page.locator('#verify-submit')).toBeEnabled();
    const altered = { ...expired, endorsement: { ...expired.endorsement, message: { ...expiredMessage, subject: 'github:12345' } } };
    const alteredHash = await wallet.sendTransaction({ to: fixture.resolver, data: setTextData(fixture.name, JSON.stringify(altered)) });
    await publicClient.waitForTransactionReceipt({ hash: alteredHash }); await settle();
    await page.locator('#verify-submit').click();
    await browserExpect(page.locator('#verify-evidence-status')).toHaveText('invalid');
    await browserExpect(page.locator('#verify-signature-status')).toHaveText('invalid');
    await browserExpect(map).toBeHidden();
    await browserExpect(page.locator('#verify-policy-b-status')).toHaveText('not_evaluated');
    await browserExpect(page.locator('#verify-vouched-by')).toBeHidden();
    await page.locator('[data-tab="publish"]').click();
    await browserExpect(page.locator('#connect')).toBeVisible();
    await browserExpect(page.locator('#panel-publish')).toBeVisible();
    expect([...methods].every(method => !/send|sign|Accounts/.test(method))).toBe(true);
    expect(external).toEqual([]); expect(errors).toEqual([]);
  } finally { await browser.close(); site.kill(); await site.exited; }
}, 120000);
