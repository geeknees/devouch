// ABOUTME: Runs each integration file in its own Bun process and fresh loopback EVM.
// ABOUTME: Isolates browser transport lifetimes and closes every fixture after success or failure.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { startLocalChain } from './local-chain.ts';

const files = (await readdir('test/integration', { recursive: true })).filter(path => path.endsWith('.test.ts')).sort();
if (!files.length) throw new Error('No integration test files found');
let failed = false;
for (const file of files) {
  const server = await startLocalChain();
  try {
    // Separate processes prevent a finalized old browser pipe from closing a newer browser's descriptor in Bun.
    const status = await new Promise<number>((resolve, reject) => {
      const child = spawn('bun', ['test', 'test/integration/' + file], {
        env: { ...process.env, DEVOUCH_TEST_RPC: server.url }, stdio: 'inherit',
      });
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 1));
    });
    if (status !== 0) failed = true;
  } finally { await server.close(); }
}
process.exitCode = failed ? 1 : 0;
