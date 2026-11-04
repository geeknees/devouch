// ABOUTME: Runs the ERC-8004 evaluation against a fresh loopback-only EVM.
// ABOUTME: Prints a reproducible evidence report or runs its real-contract acceptance tests.
import { spawn } from 'node:child_process';
import { startLocalChain } from './local-chain.ts';
const mode = process.argv[2] ?? 'demo';
if (!['demo', 'test'].includes(mode)) throw new Error('Usage: node scripts/evaluate-erc8004.ts [demo|test]');
const server = await startLocalChain();
try {
  process.exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn('bun', mode === 'test' ? ['test', 'test/integration/erc8004.test.ts'] : ['scripts/erc8004-demo.ts'],
      { env: { ...process.env, DEVOUCH_TEST_RPC: server.url }, stdio: 'inherit' });
    child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
  });
} finally { await server.close(); }
