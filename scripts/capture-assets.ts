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
  const external: string[] = [];
  await page.route('**/*', async route => {
    if (new URL(route.request().url()).origin === url) await route.continue();
    else { external.push(route.request().url()); await route.abort(); }
  });
  await page.goto(url);
  const fontFaces = (await readFile('dist/web/style.css', 'utf8')).match(/@font-face\s*\{[^}]+\}/g)?.join('\n');
  if (!fontFaces) throw new Error('Build the bundled workspace fonts before capture');
  for (const [name, width, height] of [['logo', 512, 512], ['cover', 1280, 720]] as const) {
    await page.setViewportSize({ width, height });
    const svg = await readFile('assets/devouch-' + name + '.svg', 'utf8');
    // Use the same local fonts while rendering, without editing the designer's SVG source.
    const styles = [...svg.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]!.replace(/@import\s+url\([^)]*\);/g, '')).join('\n');
    const artwork = svg.replace(/<style>[\s\S]*?<\/style>/g, '');
    const stylesheet = url + '/capture-' + name + '.css';
    // A same-origin stylesheet also respects the workspace's strict content security policy.
    await page.route(stylesheet, route => route.fulfill({ contentType: 'text/css', body: fontFaces + '\n' + styles + '\nbody { margin: 0; }' }));
    await page.setContent('<html><head><link rel="stylesheet" href="' + stylesheet + '"></head><body>' + artwork + '</body></html>', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    if (name === 'cover') {
      const loaded = await page.evaluate(() => ['Instrument Serif', 'IBM Plex Sans', 'IBM Plex Mono'].every(family =>
        [...document.fonts].some(face => face.family.replaceAll('"', '') === family && face.status === 'loaded')));
      if (!loaded) throw new Error('The cover did not load all three bundled typefaces');
    }
    await page.screenshot({ path: output + '/' + name + '.png' });
  }
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output + '/workspace.png', fullPage: true });
  await page.locator('[data-tab="setup"]').click();
  await page.locator('.workspace').screenshot({ path: output + '/ens-setup.png' });
  await page.locator('[data-tab="revoke"]').click();
  await page.locator('.workspace').screenshot({ path: output + '/withdraw.png' });
  if (external.length) throw new Error('Capture requested an external resource: ' + external.join(', '));
  console.log('Captured logo, cover, and three workspace screens in ' + output);
} finally {
  await browser.close();
  site.kill('SIGTERM');
}
