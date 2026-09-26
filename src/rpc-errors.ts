// ABOUTME: Classifies RPC failures without exposing provider messages or credential-bearing URLs.
// ABOUTME: Preserves the stable unavailable evidence code while supplying optional diagnostic categories.
import { EvidenceError } from './errors';

export type RpcIssue = 'rate_limited' | 'provider_limit' | 'history_unavailable' | 'timeout' | 'connection_failed';
export function classifyRpcFailure(error: unknown): RpcIssue {
  const seen = new Set<unknown>();
  let current = error;
  let limited = false;
  for (let depth = 0; depth < 12 && current && typeof current === 'object' && !seen.has(current); depth++) {
    seen.add(current);
    const value = current as Record<string, unknown>;
    const description = [value.name, value.shortMessage, value.message, value.details]
      .filter((part): part is string => typeof part === 'string').map(part => part.slice(0, 4096)).join(' ');
    if (value.status === 429 || /rate.?limit|too many requests|requests per|quota exceeded/i.test(description)) return 'rate_limited';
    if (value.code === -32005 || /block range|too many results|response size.*limit/i.test(description)) limited = true;
    if (/missing trie node|historical (?:state|data).*(?:not available|unavailable)|state.*pruned|archive (?:node|data).*required|old state.*(?:available|pruned)/i.test(description)) return 'history_unavailable';
    if (/timeout|timed out|aborterror/i.test(description)) return 'timeout';
    current = value.cause;
  }
  return limited ? 'provider_limit' : 'connection_failed';
}

export class RpcUnavailableError extends EvidenceError {
  readonly rpcIssue: RpcIssue;
  constructor(error: unknown) {
    super('rpc_unavailable', 'unavailable');
    this.rpcIssue = classifyRpcFailure(error);
  }
}

export function diagnosticReason(error: unknown): string {
  return error instanceof RpcUnavailableError ? error.rpcIssue
    : error instanceof EvidenceError ? error.code : classifyRpcFailure(error);
}
