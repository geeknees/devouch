// ABOUTME: Proves RPC failures retain their cause through official-contract verification paths.
// ABOUTME: Distinguishes provider rate limits from actual unsupported resolver reverts.
import { expect, test } from 'bun:test';
import { encodeFunctionData, type Hex } from 'viem';
import { ChainReader } from '../../src/chain';
import { FACTORY, factoryAbi } from '../../src/ens';
import { connectionProbe, diagnoseConnection } from '../../src/rpc-diagnostics';
import { setupEvm, settle, testRpc } from '../support/evm';

test('factory read limits are unavailable RPC evidence, while contract reverts remain unsupported', async () => {
  const fixture = await setupEvm(); await settle();
  const selector = encodeFunctionData({ abi: factoryAbi, functionName: 'verifyContract', args: [fixture.resolver] }).slice(0, 10);
  let mode = 'limit', logCalls = 0;
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    const raw = await request.text();
    const body = JSON.parse(raw);
    if (mode === 'logs' && body.method === 'eth_getLogs') {
      logCalls++;
      return Response.json({ jsonrpc: '2.0', id: body.id, error: { code: -32005, message: 'rate limit exceeded' } });
    }
    if (body.method === 'eth_call' && body.params[0].to.toLowerCase() === FACTORY.toLowerCase()
      && (body.params[0].data as Hex).startsWith(selector) && mode !== 'logs') {
      return Response.json({ jsonrpc: '2.0', id: body.id, error: mode === 'limit'
        ? { code: -32005, message: 'Rate limit exceeded for https://private.test/secret' }
        : { code: 3, message: 'execution reverted', data: '0x' } });
    }
    return fetch(testRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw });
  } });
  try {
    const reader = new ChainReader(`http://127.0.0.1:${server.port}`);
    await expect(reader.prepare(fixture.name, (await new ChainReader(testRpc).inspectName(fixture.name)).state.latestOwner))
      .rejects.toMatchObject({ code: 'rpc_unavailable', status: 'unavailable', rpcIssue: 'rate_limited' });
    mode = 'revert';
    await expect(reader.verifyName(fixture.name)).rejects.toMatchObject({ code: 'unsupported_resolver', status: 'unavailable' });
    mode = 'logs';
    await expect(reader.prepare(fixture.name, (await new ChainReader(testRpc).inspectName(fixture.name)).state.latestOwner))
      .rejects.toMatchObject({ code: 'rpc_unavailable', rpcIssue: 'rate_limited' });
    expect(logCalls).toBe(1);
    const checked = await diagnoseConnection(connectionProbe(testRpc));
    expect(checked.checks[0]!.status).toBe('passed');
    // Local fixtures install fixed addresses after the recorded Sepolia deployment block.
    expect(checked.checks[1]!.reason).toBe('historical_code_mismatch');
    expect(checked.checks[2]!.status).toBe('passed');
  } finally { server.stop(true); }
}, 120000);
