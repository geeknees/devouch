// ABOUTME: Starts a loopback-only disposable Hardhat EVM for integration tests.
// ABOUTME: Exposes no funded real account or private key and makes no public-chain writes.
import { createServer } from 'node:http';
import hre from 'hardhat';

export async function startLocalChain(port = 0) {
const connection = await hre.network.create('node');
const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin) {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) { response.writeHead(403).end(); return; }
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'content-type');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
  if (request.method !== 'POST') { response.writeHead(405).end(); return; }
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 2_000_000) { response.writeHead(413).end(); return; }
  }
  try {
    const input = JSON.parse(raw);
    const call = async (item: { id: unknown; method: string; params: unknown[] }) => {
      try { return { jsonrpc: '2.0', id: item.id, result: await connection.provider.request({ method: item.method, params: item.params }) }; }
      catch (error) { return { jsonrpc: '2.0', id: item.id, error: { code: -32000, message: error instanceof Error ? error.message : 'EVM error' } }; }
    };
    const output = Array.isArray(input) ? await Promise.all(input.map(call)) : await call(input);
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(output));
  } catch { response.writeHead(400).end(); }
});
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});
const bound = server.address();
if (!bound || typeof bound === 'string') throw new Error('Local EVM listener unavailable');
return { url: `http://127.0.0.1:${bound.port}`, close: async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await connection.close();
} };
}

if (process.argv[1]?.endsWith('/local-chain.ts')) {
  const server = await startLocalChain(Number(process.argv[2] ?? '18545'));
  console.log(`Local test EVM ready: ${server.url}`);
  const stop = async () => { await server.close(); process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
