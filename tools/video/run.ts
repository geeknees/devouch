// ABOUTME: Starts a disposable local EVM and runs the demo-video recorder against it.
// ABOUTME: Mirrors scripts/test-integration.ts so the recorder uses the same official-contract fixture.
import { spawn } from 'node:child_process';
import { startLocalChain } from '../../scripts/local-chain.ts';

const server = await startLocalChain();
try {
  const status = await new Promise<number>((resolve, reject) => {
    const child = spawn('bun', ['tools/video/record.ts', ...process.argv.slice(2)], {
      env: { ...process.env, DEVOUCH_TEST_RPC: server.url }, stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  process.exitCode = status;
} finally { await server.close(); }
