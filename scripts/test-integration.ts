// ABOUTME: Runs integration tests against a fresh local EVM on an ephemeral loopback port.
// ABOUTME: Closes the node on success and failure so test runs never share chain state.
import { spawn } from 'node:child_process';
import { startLocalChain } from './local-chain.ts';

const server = await startLocalChain();
try {
  const status = await new Promise<number>((resolve, reject) => {
    const child = spawn('bun', ['test', 'test/integration'], {
      env: { ...process.env, DEVOUCH_TEST_RPC: server.url }, stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  process.exitCode = status;
} finally { await server.close(); }
