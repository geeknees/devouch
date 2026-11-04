// ABOUTME: Keeps the public CLI and TypeScript release identity aligned with the package version.
// ABOUTME: Distinguishes the 0.3.0 verification rules from the ERC-8004 reference format.
import { expect, test } from 'bun:test';
import manifest from '../../package.json';
import { VERSION } from '../../src/json';

test('the package, TypeScript client, and installed CLI identify release 0.3.0', async () => {
  expect(manifest.version).toBe('0.3.0');
  expect(VERSION).toBe(manifest.version);
  const cli = Bun.spawn(['ruby', 'exe/devouch', '--version'], { stdout: 'pipe', stderr: 'pipe' });
  const [status, output] = await Promise.all([cli.exited, new Response(cli.stdout).text()]);
  expect(status).toBe(0);
  expect(output.trim()).toBe(`Devouch ${manifest.version}`);
});
