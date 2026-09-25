// ABOUTME: Accepts one bounded JSON request from the Ruby CLI and returns one structured result.
// ABOUTME: Contains read-only chain operations and redacts all provider exception text.
import { ChainReader } from './chain';
import { object, parseCredential, strictJson, subject, type ParsedCredential } from './credential';
import { EvidenceError, insist } from './errors';
import { makeRequest, makeRevoke, publicationHint } from './operations';

export async function execute(input: Record<string, unknown>) {
  let parsed: ParsedCredential | undefined;
  try {
    const command = input.command;
    insist(['verify', 'request', 'fetch', 'revoke'].includes(command as string), 'invalid_command');
    if (command === 'verify' || command === 'revoke') {
      insist(typeof input.raw === 'string');
      parsed = await parseCredential(input.raw);
      if (command === 'verify') insist(parsed.message.subject === subject(input.subject), 'subject_mismatch');
    }
    insist(typeof input.rpc_url === 'string', 'invalid_rpc_url');
    const reader = new ChainReader(input.rpc_url);
    const hint = input.publication === undefined ? undefined : publicationHint(input.publication);
    if (command === 'verify') {
      const evidence = await reader.inspect(parsed!, hint), m = parsed!.message;
      return { ...evidence, current_value: undefined, subject: m.subject, issuer: m.issuer, scope: m.scope, resolver: m.resolver };
    }
    if (command === 'fetch') {
      insist(typeof input.name === 'string');
      return await reader.fetch(input.name, hint);
    }
    if (command === 'revoke') return { request: await makeRevoke(parsed!.raw, reader) };
    insist(typeof input.name === 'string' && typeof input.issuer === 'string' && typeof input.subject === 'string' && typeof input.expires_at === 'string');
    return { request: await makeRequest({ name: input.name, issuer: input.issuer, subject: input.subject, expiresAt: input.expires_at }, reader) };
  } catch (error) {
    if (error instanceof EvidenceError) {
      if (input.command === 'verify') return { evidence_status: error.status, reason_codes: [error.code], snapshot: null,
        subject: typeof input.subject === 'string' ? input.subject : null, issuer: parsed?.message.issuer ?? null,
        scope: parsed?.message.scope ?? null, human_verification: 'not_included' };
      return { error: { code: error.code, message: error.code.replaceAll('_', ' ') }, exit_status: error.status === 'unavailable' ? 3 : 2 };
    }
    return { error: { code: 'internal_error', message: 'The verifier could not complete the operation.' }, exit_status: 70 };
  }
}

async function main() {
  try {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk.toString('utf8');
      insist(Buffer.byteLength(input) <= 65_536);
    }
    const result = await execute(object(strictJson(input, 65_536)));
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch {
    process.stdout.write(JSON.stringify({ error: { code: 'invalid_bridge_input', message: 'Invalid verifier request.' }, exit_status: 4 }) + '\n');
  }
}
if (process.argv[1]?.endsWith('/bridge.mjs') || process.argv[1]?.endsWith('/bridge.ts')) await main();
