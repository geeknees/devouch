// ABOUTME: Renders native brand artwork and captures three actual static workspace screens.
// ABOUTME: Creates submission drafts without simulating successful Sepolia operations.
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const output = 'docs/submission-assets';
await mkdir(output, { recursive: true });
const site = spawn('node', ['scripts/serve.ts', '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
const url = await new Promise<string>((resolve, reject) => {
  site.once('error', reject);
  site.once('exit', code => reject(new Error('Static server exited before capture: ' + code)));
  site.stdout.once('data', chunk => {
    const address = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    address ? resolve(address) : reject(new Error('Static server did not return its address'));
  });
});
const browser = await chromium.launch({ headless: true,
  ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  for (const [name, width, height] of [['logo', 512, 512], ['cover', 1280, 720]] as const) {
    await page.setViewportSize({ width, height });
    const svg = await readFile('assets/devouch-' + name + '.svg', 'utf8');
    await page.setContent('<html><body style="margin:0">' + svg + '</body></html>', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: output + '/' + name + '.png' });
  }
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto(url);
  await page.screenshot({ path: output + '/workspace.png', fullPage: true });
  await page.locator('[data-tab="setup"]').click();
  await page.locator('.workspace').screenshot({ path: output + '/ens-setup.png' });
  await page.locator('[data-tab="revoke"]').click();
  await page.locator('.workspace').screenshot({ path: output + '/withdraw.png' });
  console.log('Captured logo, cover, and three workspace screens in ' + output);
} finally {
  await browser.close();
  site.kill('SIGTERM');
}
