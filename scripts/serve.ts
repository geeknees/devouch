// ABOUTME: Serves only the built static workspace on loopback for local wallet use.
// ABOUTME: Does not expose repository files, credentials, or an issuance API.
import { resolve, sep, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
const root = resolve('dist/web');
const port = Number(process.argv[2] ?? 4173);
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405).end(); return; }
  let path: string;
  try { path = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400).end(); return; }
  const filePath = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  if (!filePath.startsWith(root + sep)) { response.writeHead(404).end(); return; }
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src https: http://127.0.0.1:* http://localhost:*; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch { response.writeHead(404).end(); }
});
server.listen(port, '127.0.0.1', () => {
  const bound = server.address();
  if (bound && typeof bound !== 'string') console.log('Devouch workspace: http://127.0.0.1:' + bound.port);
});
