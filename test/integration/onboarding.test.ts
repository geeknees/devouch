// ABOUTME: Exercises maintainer adoption with live hierarchical evidence and explicit trust selection.
// ABOUTME: Checks downloaded configuration, invalid evidence, stale form invalidation, and wallet-free mobile use.
import { expect, test } from 'bun:test';
import { chromium, expect as browserExpect } from '@playwright/test';
import { setupHierarchy, issueLeaf, send, textData } from '../support/hierarchy';
import { settle, testRpc, issuer } from '../support/evm';
import { parsePolicy, evaluatePolicy } from '../../src/policy';
import { RESOLVER_IMPL } from '../../src/ens';

test('a maintainer explicitly selects issuers and exports policy plus a pinned workflow without a wallet', async () => {
  const fixture = await setupHierarchy(), first = fixture.leaves[0]!, second = fixture.leaves[1]!;
  await issueLeaf(first); await issueLeaf(second);
  const site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  const url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  if (!url) { site.kill(); throw new Error('Static test site did not start'); }
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const external: string[] = [], errors: string[] = [], methods = new Set<string>();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      if (new URL(route.request().url()).origin === url) return route.continue();
      if (new URL(route.request().url()).origin !== 'https://sepolia.gateway.tenderly.co') {
        external.push(route.request().url()); return route.abort();
      }
      methods.add(route.request().postDataJSON().method);
      const response = await fetch(testRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: route.request().postData()! });
      return route.fulfill({ json: await response.json() });
    });
    await page.goto(url + '/#maintainers');
    expect(await page.evaluate(() => typeof window.ethereum)).toBe('undefined');
    await browserExpect(page.locator('#connect')).toBeHidden();
    await page.locator('#maintainer-names').fill(first.name + '\n' + second.name);
    await page.locator('#maintainer-repository').fill('maintainer/project');
    await page.locator('#maintainer-check').click();
    await browserExpect(page.locator('#status')).toContainText('Endorsements checked');
    await browserExpect(page.locator('[data-maintainer-select]')).toHaveCount(2);
    await browserExpect(page.locator('#maintainer-export')).toBeHidden();
    await page.locator('[data-maintainer-select]').first().check();
    await browserExpect(page.locator('#maintainer-policy-download')).toBeDisabled();
    await page.locator('[data-maintainer-select]').last().check();
    await page.locator('#maintainer-consent').check();
    const policyDownload = page.waitForEvent('download');
    await page.locator('#maintainer-policy-download').click();
    const policy = parsePolicy(await Bun.file((await (await policyDownload).path())!).text());
    expect(policy.repositoryId).toBe('maintainer/project'); expect(policy.trustedIssuers).toEqual([issuer.address]);
    expect(policy.allowedResolvers.map(entry => entry.address)).toEqual([first.resolver, second.resolver]);
    expect(evaluatePolicy(policy, { evidence_status: 'valid', reason_codes: [], issuer: issuer.address,
      scope: 'oss-contribution', resolver: first.resolver, implementation: RESOLVER_IMPL }).policy_status).toBe('accepted');
    const workflowDownload = page.waitForEvent('download');
    await page.locator('#maintainer-workflow-download').click();
    const workflow = await Bun.file((await (await workflowDownload).path())!).text();
    expect(workflow).toContain('geeknees/devouch@' + await page.locator('#maintainer-action-sha').inputValue());
    expect(workflow).toContain('mode: report'); expect(workflow).not.toContain('checkout');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/devouch-maintainers-mobile.png', fullPage: true });
    await page.locator('#maintainer-action-sha').fill('main');
    await browserExpect(page.locator('#maintainer-export')).toBeHidden();
    await browserExpect(page.locator('#maintainer-selection-status')).toHaveText('invalid_action_sha');
    await page.locator('#maintainer-names').fill(second.name);
    await browserExpect(page.locator('[data-maintainer-select]')).toHaveCount(0);
    await send(second.resolver, textData(second.name, '')); await settle();
    await page.locator('#maintainer-check').click();
    await browserExpect(page.locator('#status')).toContainText('Endorsements checked');
    await browserExpect(page.locator('#maintainer-candidates')).toContainText('missing');
    await browserExpect(page.locator('[data-maintainer-select]')).toHaveCount(0);
    await browserExpect(page.locator('#maintainer-policy-download')).toBeDisabled();
    expect([...methods].every(method => !/send|sign|Accounts/.test(method))).toBe(true);
    expect(errors).toEqual([]); expect(external).toEqual([]);
  } finally { await browser.close(); site.kill(); await site.exited; }
}, 120000);
