// ABOUTME: Checks theme preference, first paint, and keyboard use in the real static workspace.
// ABOUTME: Verifies both palettes and mobile layouts without a wallet or external requests.
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { chromium, expect as browserExpect, type Browser, type Page } from '@playwright/test';
import type { Subprocess } from 'bun';

let browser: Browser, site: Subprocess<'ignore', 'pipe', 'pipe'>, url: string, page: Page;
let pageErrors: string[], externalRequests: string[];
beforeAll(async () => {
  site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] ?? '';
  if (!url) throw new Error('Static test site did not start');
  browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
}, 30000);
afterAll(async () => { await browser?.close(); site?.kill(); if (site) await site.exited; });
beforeEach(async () => {
  pageErrors = []; externalRequests = [];
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
  await page.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).origin === url && request.method() === 'GET') await route.continue();
    else { externalRequests.push(request.url()); await route.abort(); }
  });
});
afterEach(async () => {
  try { expect(pageErrors).toEqual([]); expect(externalRequests).toEqual([]); }
  finally { await page?.close(); }
});

test('the theme switch preserves the current form and remembers keyboard selection', async () => {
  await page.goto(url);
  await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.locator('#subject-id').fill('701242');
  await page.locator('[data-tab="retrieve"]').click();
  const toggle = page.getByRole('button', { name: 'Switch to light mode' });
  await browserExpect(toggle).toBeVisible({ timeout: 1500 });
  await toggle.focus();
  await toggle.press('Enter');
  await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await browserExpect(page.locator('#panel-retrieve')).toBeVisible();
  await browserExpect(page.locator('#subject-id')).toHaveValue('701242');
  await browserExpect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeFocused();
  expect(await page.evaluate(() => typeof window.ethereum)).toBe('undefined');
  await page.reload();
  await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).press('Space');
  await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.reload();
  await browserExpect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
}, 15000);

test('the saved light palette is applied before the application bundle arrives', async () => {
  await page.addInitScript(() => localStorage.setItem('devouch.theme.v1', 'light'));
  let releaseBundle = () => {};
  const gate = new Promise<void>(resolve => { releaseBundle = resolve; });
  await page.route('**/app.js', async route => { await gate; await route.continue(); });
  try {
    await page.goto(url, { waitUntil: 'commit' });
    await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'light');
    await browserExpect(page.locator('input#subject-id')).toHaveCSS('color-scheme', 'light');
  } finally { releaseBundle(); }
  await page.waitForLoadState('load');
  await browserExpect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
}, 15000);

test.each(['getItem', 'setItem'])('the switch works when localStorage.%s is unavailable', async method => {
  await page.addInitScript(method => {
    Object.defineProperty(Storage.prototype, method, { value() { throw new DOMException('Storage unavailable', 'SecurityError'); } });
  }, method);
  await page.goto(url);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
}, 15000);

test('an unsupported saved preference falls back to the default dark palette', async () => {
  await page.addInitScript(() => localStorage.setItem('devouch.theme.v1', 'invalid'));
  await page.goto(url);
  await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await browserExpect(page.locator('html')).toHaveCSS('color-scheme', 'light');
}, 15000);

test.each(['dark', 'light'])('%s mode keeps text readable and all tabs within the viewport', async theme => {
  await page.goto(url);
  if (theme === 'light') await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.evaluate(() => document.fonts.ready);
  const contrast = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const luminance = (name: string) => {
      const hex = style.getPropertyValue(name).trim().slice(1);
      const channels = [0, 2, 4].map(offset => {
        const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
    };
    const pairs = ['--void', '--panel', '--panel-2'].flatMap(background =>
      ['--bone', '--dim', '--moss', '--lime', '--ember'].map(foreground => [foreground, background]));
    pairs.push(['--void', '--lime'], ['--void', '--accent-hover']);
    return pairs.map(([foreground, background]) => {
      const values = [luminance(foreground!), luminance(background!)].sort((a, b) => a - b);
      return { pair: foreground + '/' + background, ratio: (values[1]! + .05) / (values[0]! + .05) };
    });
  });
  for (const { pair, ratio } of contrast) expect(ratio, theme + ': ' + pair).toBeGreaterThanOrEqual(4.5);
  for (const width of [320, 390, 600, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const tab of ['publish', 'retrieve', 'revoke', 'setup']) {
      await page.locator('[data-tab="' + tab + '"]').click();
      await browserExpect(page.locator('#panel-' + tab)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        theme + ' / ' + width + ' / ' + tab).toBe(true);
    }
    await page.locator('#theme-toggle').scrollIntoViewIfNeeded();
    await browserExpect(page.locator('#theme-toggle')).toBeInViewport();
    expect(await page.locator('#theme-toggle').evaluate(target => {
      const box = target.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
    })).toBe(true);
  }
}, 20000);
