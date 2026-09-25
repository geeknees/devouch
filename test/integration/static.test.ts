// ABOUTME: Verifies that the distributed workspace loads its typefaces without external services.
// ABOUTME: Checks real browser font decoding and static-server MIME handling while remote requests are blocked.
import { expect, test } from 'bun:test';
import { chromium } from '@playwright/test';

test('workspace fonts load from the static distribution with all external requests blocked', async () => {
  const site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { stdout: 'pipe', stderr: 'pipe' });
  const output = await site.stdout.getReader().read();
  const url = new TextDecoder().decode(output.value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  if (!url) { site.kill(); throw new Error('Static test site did not start'); }
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    const page = await browser.newPage();
    const external: string[] = [], fontResponses: { url: string; status: number; type?: string }[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.request().resourceType() === 'font') fontResponses.push({ url: response.url(),
        status: response.status(), type: response.headers()['content-type'] });
    });
    await page.route('**/*', async route => {
      if (new URL(route.request().url()).origin === url) await route.continue();
      else { external.push(route.request().url()); await route.abort(); }
    });
    await page.goto(url);
    const faces = ['400 16px "Instrument Serif"', 'italic 400 16px "Instrument Serif"',
      '400 16px "IBM Plex Sans"', '500 16px "IBM Plex Sans"',
      '400 16px "IBM Plex Mono"', '500 16px "IBM Plex Mono"'];
    const loaded = await page.evaluate(async specs => Promise.all(specs.map(async spec => {
      const matches = await document.fonts.load(spec, 'Devouch');
      return matches.length > 0 && matches.every(face => face.status === 'loaded');
    })), faces);
    expect(loaded).toEqual(faces.map(() => true));
    expect(fontResponses.length).toBeGreaterThan(0);
    expect(fontResponses.every(response => response.url.startsWith(url + '/fonts/') &&
      response.status === 200 && response.type === 'font/woff2')).toBe(true);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await browser.close(); site.kill(); await site.exited; }
}, 30000);
