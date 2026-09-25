// ABOUTME: Records the demo-video clips from the real workspace, CLI, and presentation pages, cued to the narration.
// ABOUTME: Runs on a local EVM with official ENSv2 bytecode, labels that on screen, and never speeds footage up.
import { chromium, type Browser, type Locator, type Page } from '@playwright/test';
import { mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { RESOLVER_IMPL } from '../../src/ens';
import { issuer, wallet, setupEvm, settle, testRpc, rpc } from '../../test/support/evm';
import type { Address, Hex } from 'viem';
import { LEAD, OUT, ROOT, TAIL, loadTimings, normalize, phraseTime, scriptByClip } from './timing.ts';

const RAW = join(OUT, 'raw'), CLIPS = join(OUT, 'clips'), WORK = join(OUT, 'work');
const VIEW = { width: 1600, height: 900 };
const FINAL = { width: 1920, height: 1080, fps: 30 };
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=block">';
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
const timings = loadTimings();

type Clip = { name: string; file: string; start: number; end: number };
const clips: Clip[] = [];

// ---------- Recording helpers ----------
/** Waits for moments in the narration. Times are relative to the clip's first frame, where the voice starts LEAD seconds in. */
type Cue = { at: (phrase: string, offset?: number) => Promise<void>; end: () => Promise<void> };

async function recordClip(browser: Browser, name: string, body: (page: Page, start: () => Cue) => Promise<void>,
  options: { overlay?: boolean } = {}) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, recordVideo: { dir: RAW, size: VIEW } });
  if (options.overlay) await context.addInitScript(overlayScript);
  await installWallet(context);
  const page = await context.newPage();
  const opened = Date.now();
  let start = -1;
  const timing = timings[name];
  const late: string[] = [];
  const begin = (): Cue => {
    start = (Date.now() - opened) / 1000;
    const origin = Date.now();
    const until = async (seconds: number, label: string) => {
      const wait = origin + seconds * 1000 - Date.now();
      if (wait < -400) late.push(`${label} (${(-wait / 1000).toFixed(1)} s late)`);
      if (wait > 0) await pause(wait);
    };
    return {
      at: (phrase, offset = 0) => until(LEAD + phraseTime(timing, name, phrase) + offset, `"${phrase}"`),
      end: () => until(LEAD + timing.duration + TAIL, 'end of narration'),
    };
  };
  await body(page, begin);
  if (start < 0) throw new Error(`${name} never started its narration clock`);
  const end = (Date.now() - opened) / 1000;
  const video = page.video()!;
  await context.close();
  const file = join(RAW, name + '.webm');
  await video.saveAs(file);
  await video.delete();
  clips.push({ name, file, start, end });
  console.log(`recorded ${name}: ${(end - start).toFixed(1)} s (${timing.source} timing)` + (late.length ? `; late: ${late.join(', ')}` : ''));
}

// A visible cursor and an honest "local EVM" label, injected into recorded app pages only.
function overlayScript() {
  addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.zoom = '1.3';
    const cursor = document.createElement('div');
    Object.assign(cursor.style, { position: 'fixed', left: '-40px', top: '-40px', width: '26px', height: '26px', margin: '-13px 0 0 -13px',
      borderRadius: '50%', border: '2px solid #466231', background: 'rgba(213,245,148,.45)', pointerEvents: 'none',
      zIndex: '2147483647', transition: 'transform .12s ease' });
    const badge = document.createElement('div');
    badge.textContent = 'Recorded on a local EVM running the official ENSv2 contracts · not Sepolia';
    Object.assign(badge.style, { position: 'fixed', left: '16px', bottom: '14px', padding: '7px 12px', borderRadius: '999px',
      font: '500 12px ui-monospace, Menlo, monospace', color: '#e8ecdd', background: 'rgba(11,14,10,.82)', zIndex: '2147483646',
      pointerEvents: 'none', letterSpacing: '.02em' });
    document.body.append(cursor, badge);
    addEventListener('mousemove', e => { cursor.style.left = e.clientX / 1.3 + 'px'; cursor.style.top = e.clientY / 1.3 + 'px'; }, true);
    addEventListener('mousedown', () => { cursor.style.transform = 'scale(.72)'; }, true);
    addEventListener('mouseup', () => { cursor.style.transform = ''; }, true);
  });
}

let signatureRequests = 0;
async function installWallet(context: import('@playwright/test').BrowserContext) {
  await context.exposeBinding('testWalletRequest', async (_source, input: { method: string; params?: unknown[] }) => {
    try {
      const params = input.params ?? [];
      if (input.method === 'eth_requestAccounts' || input.method === 'eth_accounts') return { result: [issuer.address] };
      if (input.method === 'eth_signTypedData_v4') { signatureRequests++; return { result: await issuer.signTypedData(JSON.parse(params[1] as string)) }; }
      if (input.method === 'eth_sendTransaction') {
        const tx = params[0] as { to: Address; data: Hex };
        const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data });
        await settle();
        return { result: hash };
      }
      return { result: await rpc(input.method, params) };
    } catch { return { error: { code: -32000, message: 'Demo wallet failed' } }; }
  });
  await context.addInitScript(() => {
    const w = window as unknown as { ethereum: unknown; testWalletRequest: (input: unknown) => Promise<{ error?: { message: string; code: number }; result?: unknown }> };
    w.ethereum = { on() {}, async request(input: unknown) {
      const output = await w.testWalletRequest(input);
      if (output.error) throw Object.assign(new Error(output.error.message), { code: output.error.code });
      return output.result;
    } };
  });
}

async function glide(page: Page, target: Locator) {
  await target.evaluate(e => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await pause(700);
  const box = await target.boundingBox();
  if (!box) throw new Error('Target is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
  await pause(250);
}
async function click(page: Page, target: Locator, after = 500) { await glide(page, target); await target.click(); await pause(after); }
async function type(page: Page, target: Locator, text: string) {
  await glide(page, target); await target.click(); await target.fill(''); await target.pressSequentially(text, { delay: 60 }); await pause(300);
}
async function connectLocal(page: Page) {
  await page.locator('.rpc-settings summary').click();
  await page.locator('#rpc-url').fill(testRpc);
  await page.locator('#apply-rpc').click();
  await page.locator('#status').filter({ hasText: 'connection checked' }).waitFor();
  await page.locator('.rpc-settings summary').click();
}

// ---------- Static pages: cards and a terminal ----------
const cardCss = `*{box-sizing:border-box}html,body{margin:0;height:100%;background:#0b0e0a;color:#e8ecdd;font-family:"IBM Plex Sans",sans-serif}
.wrap{height:100%;display:grid;place-content:center;padding:0 120px;gap:22px}
.eyebrow{font:500 15px "IBM Plex Mono",monospace;letter-spacing:.18em;text-transform:uppercase;color:#7f9a66;margin:0}
h1{font:400 92px/1.02 "Instrument Serif",Georgia,serif;margin:0}h1 em{color:#d5f594}
p{font-size:24px;line-height:1.55;color:#a9b39d;margin:0;max-width:980px}
ul{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:14px;font:400 26px "IBM Plex Mono",monospace;color:#e8ecdd}
li::before{content:"× ";color:#e08a6d}
[data-step]{opacity:0;transform:translateY(8px);transition:opacity .9s ease,transform .9s ease}[data-step].on{opacity:1;transform:none}`;
const card = (html: string) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${cardCss}</style></head><body><div class="wrap">${html}</div>
<script>window.reveal=k=>document.querySelectorAll('[data-step="'+k+'"]').forEach(e=>e.classList.add('on'));</script></body></html>`;
const reveal = (page: Page, step: number) => page.evaluate(k => (window as unknown as { reveal: (k: number) => void }).reveal(k), step);

type TermStep = { cmd: string; out: string };
function terminal(title: string, steps: TermStep[]) {
  const data = JSON.stringify(steps).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;background:#0b0e0a}
.win{position:absolute;inset:56px 70px;background:#10140e;border:1px solid #2b3326;border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.bar{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #2b3326;font:500 13px "IBM Plex Mono",monospace;color:#8e9a82}
.bar i{width:11px;height:11px;border-radius:50%;background:#2b3326;display:inline-block}.bar span{margin-left:10px}
pre{margin:0;padding:26px 30px;font:400 19px/1.62 "IBM Plex Mono",monospace;color:#e8ecdd;white-space:pre-wrap;word-break:break-all;flex:1;overflow:hidden}
.p{color:#7f9a66}.ok{color:#d5f594}.bad{color:#e08a6d}.dim{color:#8e9a82}
.badge{position:fixed;left:16px;bottom:14px;padding:7px 12px;border-radius:999px;font:500 12px "IBM Plex Mono",monospace;color:#e8ecdd;background:rgba(11,14,10,.82)}
</style></head><body><div class="win"><div class="bar"><i></i><i></i><i></i><span>${title}</span></div><pre id="t"></pre></div>
<div class="badge">Recorded on a local EVM running the official ENSv2 contracts · not Sepolia</div>
<script>
const steps=${data};const t=document.getElementById('t');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const paint=l=>esc(l).replace(/\\b(valid|accepted)\\b/g,'<span class="ok">$1</span>').replace(/\\b(rejected|revoked|not_evaluated)\\b/g,'<span class="bad">$1</span>').replace(/^(Human verification.*)$/,'<span class="dim">$1</span>');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
window.typeCommand=async k=>{const line=document.createElement('div');line.innerHTML='<span class="p">$ </span>';t.append(line);
for(const ch of steps[k].cmd){line.append(ch);await wait(24);}};
window.showOutput=async k=>{for(const l of steps[k].out.split('\\n')){const d=document.createElement('div');d.innerHTML=paint(l)||'&nbsp;';t.append(d);await wait(70);}
t.append(document.createElement('br'));};
</script></body></html>`;
}
type TermWindow = { typeCommand: (k: number) => Promise<void>; showOutput: (k: number) => Promise<void> };
const typeCommand = (page: Page, k: number) => page.evaluate(i => (window as unknown as TermWindow).typeCommand(i), k);
const showOutput = (page: Page, k: number) => page.evaluate(i => (window as unknown as TermWindow).showOutput(i), k);

// ---------- CLI ----------
async function cli(args: string[]) {
  const child = Bun.spawn(['ruby', 'exe/devouch', ...args, '--rpc-url', testRpc], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
  const out = (await new Response(child.stdout).text()).trim();
  await child.exited;
  return out;
}
const shown = (args: string[]) => './exe/devouch ' + args.join(' ') + ' --rpc-url $LOCAL_RPC';

// ---------- Main ----------
// Keep out/audio: it holds the presenter's own voice recordings and their timings.
await Promise.all([RAW, CLIPS, WORK].map(d => rm(d, { recursive: true, force: true })));
await Promise.all([RAW, CLIPS, WORK].map(d => mkdir(d, { recursive: true })));

const fixture = await setupEvm();
await settle();
const site = Bun.spawn(['node', 'scripts/serve.ts', '0'], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' });
const url = new TextDecoder().decode((await site.stdout.getReader().read()).value).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
if (!url) { site.kill(); throw new Error('Static site did not start'); }
const browser = await chromium.launch({ headless: true,
  ...(process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });

let raw = '';
const dir = join(WORK, 'cli');
await mkdir(dir, { recursive: true });
try {
  // 01. Presentation zoom: ecosystem → repository → PR → endorsement → ENS name.
  await recordClip(browser, '01-zoom', async (page, start) => {
    await page.goto('file://' + join(ROOT, 'docs/presentation/devouch-zoom.html'));
    await page.addStyleTag({ content: '.controls{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    await page.keyboard.press(' ');
    await pause(1200);
    const cue = start();
    const zoomTo = (level: number) => page.locator('.ruler button').nth(level).click();
    await cue.at('Today, AI can write', -0.6); await zoomTo(1);
    await cue.at("Mitchell Hashimoto's", -0.8); await zoomTo(2);
    await cue.at('a small signed file', -1.6); await zoomTo(3);
    await cue.at('published on ENS', -1.4); await zoomTo(4);
    await cue.end();
  });

  // 02. The idea, on the cover.
  await recordClip(browser, '02-idea', async (page, start) => {
    const svg = await readFile(join(ROOT, 'assets/devouch-cover.svg'), 'utf8');
    await page.setContent(`<html><body style="margin:0;background:#0b0e0a;display:grid;place-items:center;height:100vh">${svg.replace('<svg ', '<svg style="width:100vw;height:auto" ')}</body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await start().end();
  });

  // 03. Publish from the static workspace with the injected demo wallet.
  await recordClip(browser, '03-publish', async (page, start) => {
    await page.goto(url);
    await connectLocal(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await pause(400);
    const cue = start();
    await cue.at('For this recording'); await click(page, page.locator('#connect'));
    await cue.at('I enter my ENS name', -0.9); await type(page, page.locator('#publish-name'), fixture.name);
    await cue.at("contributor's numeric GitHub ID", -0.6); await glide(page, page.locator('#subject-id'));
    await cue.at('and review exactly', -1.2); await click(page, page.locator('#prepare'));
    await page.locator('#review').waitFor({ state: 'visible' });
    await glide(page, page.locator('#review-details'));
    await cue.at('Signing and publishing', -0.4); await click(page, page.locator('#consent'), 300);
    await click(page, page.locator('#sign'), 0);
    await page.locator('#status').filter({ hasText: 'Signature checked' }).waitFor();
    await cue.at('The signed JSON goes', -0.6); await click(page, page.locator('#publish'), 0);
    await page.locator('#downloads').waitFor({ state: 'visible' });
    await glide(page, page.locator('#downloads'));
    await cue.at('I download the original', -0.9);
    const download = page.waitForEvent('download');
    await click(page, page.locator('#download-vouch'), 0);
    raw = await readFile((await (await download).path())!, 'utf8');
    await cue.end();
  }, { overlay: true });
  if (signatureRequests !== 1) throw new Error('Expected exactly one signature request');
  await settle();

  // 04. The same endorsement, two repository policies.
  const vouch = join(dir, 'vouch.json'), a = join(dir, 'repo-a.json'), b = join(dir, 'repo-b.json');
  await writeFile(vouch, raw);
  const policy = { repositoryId: 'demo/repo-a', chainId: 11155111, trustedIssuers: [issuer.address],
    allowedScopes: ['oss-contribution'], allowedResolvers: [{ address: fixture.resolver, implementation: RESOLVER_IMPL }], requiredIssuers: 1 };
  await writeFile(a, JSON.stringify(policy, null, 2));
  await writeFile(b, JSON.stringify({ ...policy, repositoryId: 'demo/repo-b', trustedIssuers: [] }, null, 2));
  const verifyArgs = (p: string) => ['verify', '--credential', 'vouch.json', '--policy', p, '--subject', 'github:287365775'];
  const run = (p: string) => cli(['verify', '--credential', vouch, '--policy', join(dir, p), '--subject', 'github:287365775']);
  const before = [
    { cmd: shown(verifyArgs('repo-a.json')), out: await run('repo-a.json') },
    { cmd: shown(verifyArgs('repo-b.json')), out: await run('repo-b.json') },
  ];
  if (!before[0].out.includes('valid / Policy: accepted') || !before[1].out.includes('Policy: rejected'))
    throw new Error('Unexpected verification before revocation:\n' + before.map(s => s.out).join('\n'));
  await recordClip(browser, '04-verify', async (page, start) => {
    await page.setContent(terminal('same endorsement · two repository policies', before), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const cue = start();
    await typeCommand(page, 0);
    await cue.at('Repo A trusts', -0.3); await showOutput(page, 0);
    await typeCommand(page, 1);
    await cue.at("Repo B doesn't", -0.3); await showOutput(page, 1);
    await cue.end();
  });

  // 05. Placeholder for real GitHub Action footage.
  await recordClip(browser, '05-action-slot', async (page, start) => {
    await page.setContent(card(`<p class="eyebrow" data-step="0">Insert footage here</p><h1 data-step="0">GitHub Action on a <em>real fork PR</em></h1>
      <p data-step="1">Replace this slot with the PR's Devouch check summary: author ID, base / head SHA, evidence valid, policy accepted.</p>
      <p data-step="2">Two files for maintainers. No checkout, no secrets.</p>`), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const cue = start();
    await reveal(page, 0);
    await cue.at('On every pull request'); await reveal(page, 1);
    await cue.at('It never checks out'); await reveal(page, 2);
    await cue.end();
  });

  // 06. Withdraw from the workspace.
  await recordClip(browser, '06-revoke', async (page, start) => {
    await page.goto(url);
    await connectLocal(page);
    await page.locator('#connect').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await pause(400);
    const cue = start();
    await click(page, page.locator('[data-tab="revoke"]'));
    await cue.at('I load the same endorsement', -0.8); await glide(page, page.locator('#revoke-file'));
    await page.locator('#revoke-file').setInputFiles({ name: 'vouch.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
    await page.locator('#revoke-review').waitFor({ state: 'visible' });
    await cue.at('confirm', -0.5); await click(page, page.locator('#revoke-consent'), 200);
    await cue.at('clear the record', -0.8); await click(page, page.locator('#revoke'), 0);
    await page.locator('#status').filter({ hasText: 'Withdrawn' }).waitFor();
    await glide(page, page.locator('#status'));
    await cue.end();
  }, { overlay: true });
  await settle();

  // 07. Both repositories now see the withdrawal.
  const after = [
    { cmd: shown(verifyArgs('repo-a.json')), out: await run('repo-a.json') },
    { cmd: shown(verifyArgs('repo-b.json')), out: await run('repo-b.json') },
  ];
  if (!after.every(s => s.out.includes('Evidence: revoked'))) throw new Error('Unexpected verification after revocation:\n' + after.map(s => s.out).join('\n'));
  await recordClip(browser, '07-revoked', async (page, start) => {
    await page.setContent(terminal('after withdrawal · the old JSON is still in both repositories', after), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const cue = start();
    await typeCommand(page, 0);
    await cue.at('so both now say revoked', -0.5); await showOutput(page, 0);
    await typeCommand(page, 1); await showOutput(page, 1);
    await cue.end();
  });

  // 08. Closing.
  await recordClip(browser, '08-closing', async (page, start) => {
    await page.setContent(card(`<p class="eyebrow" data-step="0">What we deliberately did not build</p>
      <ul><li data-step="1">a global reputation score</li><li data-step="2">token rewards for endorsing</li><li data-step="3">a central service you must trust</li></ul>
      <p data-step="4" style="margin-top:18px">Not proof of humanity. Not a replacement for code review.</p>
      <h1 data-step="5" style="margin-top:30px">Endorse once.<br><em data-step="6">Let each community decide.</em></h1>`), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const cue = start();
    await reveal(page, 0);
    await cue.at('a global reputation score', -0.2); await reveal(page, 1);
    await cue.at('token rewards', -0.2); await reveal(page, 2);
    await cue.at('a central service', -0.2); await reveal(page, 3);
    await cue.at("Devouch doesn't prove", -0.2); await reveal(page, 4);
    await cue.at('Endorse once', -0.2); await reveal(page, 5);
    await cue.at('Let each community decide', -0.2); await reveal(page, 6);
    await cue.end();
  });
} finally {
  await browser.close();
  site.kill();
}

// ---------- Assemble ----------
async function ffmpeg(args: string[]) {
  const child = Bun.spawn(['ffmpeg', '-y', '-loglevel', 'error', ...args], { stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error('ffmpeg failed: ' + args.join(' '));
}
const scale = `scale=${FINAL.width}:${FINAL.height}:flags=lanczos,fps=${FINAL.fps},format=yuv420p`;
const parts: string[] = [];
for (const clip of clips) {
  const out = join(CLIPS, clip.name + '.mp4');
  await ffmpeg(['-ss', clip.start.toFixed(2), '-to', clip.end.toFixed(2), '-i', clip.file,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-vf', scale, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-shortest', out]);
  parts.push(out);
}
await writeFile(join(WORK, 'concat.txt'), parts.map(p => `file '${p}'`).join('\n'));
const base = join(OUT, 'devouch-demo-base.mp4');
await ffmpeg(['-f', 'concat', '-safe', '0', '-i', join(WORK, 'concat.txt'), '-c', 'copy', base]);

// Durations, sentence subtitles from the narration timings, and an edit list.
async function duration(file: string) {
  const child = Bun.spawn(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { stdout: 'pipe' });
  return Number((await new Response(child.stdout).text()).trim());
}
const stamp = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000)), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const script = scriptByClip();
const durations = await Promise.all(parts.map(duration));
let t = 0, n = 1;
const srt: string[] = [], rows: string[] = [];
clips.forEach((clip, i) => {
  const d = durations[i], timing = timings[clip.name];
  let k = 0;
  const sentences = (script[clip.name] ?? '').split(/(?<=[.!?])\s+/).filter(Boolean).map(text => {
    const from = timing.words[k]?.t ?? 0; k += normalize(text).length; return { text, from };
  });
  sentences.forEach((s, j) => {
    const to = j + 1 < sentences.length ? sentences[j + 1].from : timing.duration;
    srt.push(`${n++}\n${stamp(t + LEAD + s.from)} --> ${stamp(t + LEAD + to - .05)}\n${s.text}\n`);
  });
  rows.push(`| ${mmss(t)}–${mmss(t + d)} | \`clips/${clip.name}.mp4\` | ${d.toFixed(1)} s | ${timing.source} |`);
  t += d;
});
await writeFile(join(OUT, 'devouch-demo-base.en.srt'), srt.join('\n'));
await writeFile(join(OUT, 'EDIT-LIST.md'), `# Demo video base

Total: ${mmss(t)} (${t.toFixed(1)} s). ETHGlobal accepts 2:00–4:00, 720p or higher, your own voice, no music, no speed-up.

| Time | Clip | Length | Timing |
| --- | --- | --- | --- |
${rows.join('\n')}

- \`devouch-demo-base.mp4\`: all clips joined, 1920×1080, 30 fps, silent audio track.
- \`devouch-demo-base.en.srt\`: one subtitle per script sentence, timed from \`audio/timings.json\` when present.
- \`clips/05-action-slot.mp4\` is a placeholder. Replace it with real footage of the Action on a fork PR.
- Every app and terminal clip was recorded on a local EVM with the official ENSv2 bytecode and says so on screen.
  Re-record against Sepolia before claiming a public-chain demo.
`);
for (const f of await readdir(RAW)) if (!clips.some(c => c.file.endsWith(f))) await rm(join(RAW, f));
console.log(`Base video: ${base} (${mmss(t)})`);
