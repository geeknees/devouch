// ABOUTME: Exercises hierarchy creation and recovery through the real mobile workspace.
// ABOUTME: Uses official local ENS contracts and verifies resulting names independently of the UI.
import { expect, test } from 'bun:test';
import { chromium, expect as browserExpect } from '@playwright/test';
import type { Address, Hex } from 'viem';
import { ChainReader } from '../../src/chain';
import { issuer, wallet, publicClient, setupEvm, settle, testRpc, rpc } from '../support/evm';

test('the namespace workspace resumes deployment and creates an independent endorsement name', async () => {
  const fixture = await setupEvm(); await settle();
  const site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  const url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  if (!url) { site.kill(); throw new Error('Static test site did not start'); }
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    let loseResponse = true, lastHash: Hex | undefined, sends = 0;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.exposeBinding('testWalletRequest', async (_source, input: { method: string; params?: unknown[] }) => {
      if (input.method === 'eth_requestAccounts' || input.method === 'eth_accounts') return { result: [issuer.address] };
      if (input.method === 'eth_sendTransaction') {
        sends++;
        lastHash = await wallet.sendTransaction(input.params![0] as { to: Address; data: Hex });
        await publicClient.waitForTransactionReceipt({ hash: lastHash }); await settle();
        if (loseResponse) { loseResponse = false; return { error: 'Response lost after delivery' }; }
        return { result: lastHash };
      }
      return { result: await rpc(input.method, input.params ?? []) };
    });
    await context.addInitScript(() => {
      const target = window as unknown as { ethereum: unknown; testWalletRequest: (input: unknown) => Promise<{ error?: string; result?: unknown }> };
      target.ethereum = { on() {}, async request(input: unknown) {
        const output = await target.testWalletRequest(input);
        if (output.error) throw new Error(output.error);
        return output.result;
      } };
    });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const connection = async () => {
      await page.locator('.rpc-settings summary').click();
      await page.locator('#rpc-url').fill(testRpc); await page.locator('#apply-rpc').click();
      await browserExpect(page.locator('#status')).toContainText('Sepolia connection checked');
    };
    const action = async (id: string, text: string) => {
      await page.locator('#' + id).click();
      await browserExpect(page.locator('#status')).toContainText(text, { timeout: 15000 });
    };
    await page.goto(url + '/#namespaces');
    await page.locator('[data-tab="namespaces"]').click({ timeout: 2000 });
    await connection();
    await page.locator('#namespace-parent').fill(fixture.name);
    await action('namespace-inspect', 'Parent checked');
    expect(sends).toBe(0);
    await action('namespace-deploy', 'outcome is unknown');
    await browserExpect(page.locator('#namespace-deploy')).toBeDisabled();
    await page.reload(); await connection();
    await page.locator('#recovery-hash').fill(lastHash!);
    await action('recover', 'Child registry created');
    await browserExpect(page.locator('#namespace-registry')).toHaveValue(/^0x[0-9a-fA-F]{40}$/);
    expect(sends).toBe(1);
    await action('namespace-parent-link', 'Parent link confirmed');
    await action('namespace-connect', 'Child registry connected');
    await page.locator('#namespace-label').fill('vouches');
    await action('namespace-register', 'Subname registered');
    await page.locator('#namespace-use-parent').click();
    await browserExpect(page.locator('#namespace-parent')).toHaveValue(`vouches.${fixture.name}`);
    await action('namespace-deploy', 'Child registry created');
    await action('namespace-parent-link', 'Parent link confirmed');
    await action('namespace-connect', 'Child registry connected');
    await page.locator('#namespace-label').fill('287365775');
    await action('namespace-register', 'Subname registered');
    const name = `287365775.vouches.${fixture.name}`;
    await browserExpect(page.locator('#namespace-record-name')).toHaveValue(name);
    await action('namespace-record-deploy', 'Dedicated resolver created');
    await page.locator('#namespace-record-consent').check();
    await action('namespace-record-bind', 'Publishing record connected');
    const reader = new ChainReader(testRpc);
    expect((await reader.prepare(name, issuer.address)).hierarchy.map(hop => hop.name)).toEqual([
      'eth', fixture.name, `vouches.${fixture.name}`, name,
    ]);
    expect((await reader.prepare(fixture.name, issuer.address)).resolver).toBe(fixture.resolver);
    await page.locator('#namespace-open-publish').click();
    await browserExpect(page.locator('#publish-name')).toHaveValue(name);
    await browserExpect(page.locator('#panel-publish')).toBeVisible();
    await page.locator('[data-tab="namespaces"]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/devouch-namespaces-mobile.png', fullPage: true });
    await page.locator('#namespace-label').fill('agent');
    await action('namespace-register', 'Subname registered');
    const agentName = `agent.vouches.${fixture.name}`;
    await page.locator('#namespace-agent-mode').check();
    await page.locator('#namespace-agent-wallet').fill('0x1111111111111111111111111111111111111111');
    const beforeAgentSetup = sends;
    await action('namespace-record-deploy', 'Enter the agent’s numeric GitHub ID');
    expect(sends).toBe(beforeAgentSetup);
    await page.locator('#namespace-agent-subject').fill('masusanou');
    await action('namespace-record-deploy', 'Enter the agent’s numeric GitHub ID');
    expect(sends).toBe(beforeAgentSetup);
    await page.locator('#namespace-agent-subject').fill('287365775');
    await page.locator('#namespace-agent-wallet').fill('');
    await action('namespace-record-deploy', 'Enter the agent’s full public wallet address');
    expect(sends).toBe(beforeAgentSetup);
    await page.locator('#namespace-agent-wallet').fill('0x1111');
    await action('namespace-record-deploy', 'Enter the agent’s full public wallet address');
    expect(sends).toBe(beforeAgentSetup);
    await page.locator('#namespace-agent-wallet').fill('0x1111111111111111111111111111111111111111');
    await action('namespace-record-deploy', 'Dedicated resolver created');
    await page.locator('#namespace-record-consent').check();
    await action('namespace-record-bind', 'Publishing record connected');
    await action('agent-inspect', 'Agent identity and current profile permissions checked');
    await browserExpect(page.locator('#agent-details')).toContainText('None');
    await browserExpect(page.locator('#agent-share-url')).toHaveValue(new RegExp('agent=' + agentName));
    await action('agent-grant', 'Profile permission granted');
    expect((await reader.readAgent(agentName)).permissions.url).toBe(true);
    await page.locator('#agent-value').fill('https://example.org/agent');
    await action('agent-update', 'Profile updated');
    expect((await reader.readAgent(agentName)).profile.url).toBe('https://example.org/agent');
    await action('agent-remove', 'Profile permission revoked');
    expect((await reader.readAgent(agentName)).permissions.url).toBe(false);
    expect(errors).toEqual([]);
  } finally { await browser.close(); site.kill(); await site.exited; }
}, 120000);
