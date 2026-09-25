// ABOUTME: Bundles the local viem reader without runtime dependency installation.
// ABOUTME: Produces release-owned JavaScript that can run from a read-only GitHub Action.
export {};
const result = await Bun.build({ entrypoints: ['src/bridge.ts'], target: 'node', format: 'esm',
  outdir: 'dist', naming: 'bridge.mjs', minify: true });
if (!result.success) { console.error(result.logs); process.exit(1); }
console.log('Built dist/bridge.mjs');
const web = await Bun.build({ entrypoints: ['web/main.ts'], target: 'browser', format: 'esm',
  outdir: 'dist/web', naming: 'app.js', minify: true });
if (!web.success) { console.error(web.logs); process.exit(1); }
await Bun.write('dist/web/index.html', Bun.file('web/index.html'));
await Bun.write('dist/web/style.css', Bun.file('web/style.css'));
await Bun.write('dist/web/devouch-logo.svg', Bun.file('assets/devouch-logo.svg'));
const notices = Bun.spawnSync(['ruby', 'scripts/notices.rb'], { stdout: 'inherit', stderr: 'inherit' });
if (notices.exitCode !== 0) process.exit(notices.exitCode);
console.log('Built dist/web');
