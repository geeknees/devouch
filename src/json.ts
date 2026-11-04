// ABOUTME: Parses bounded public JSON without duplicate keys or implicit identity conversions.
// ABOUTME: Shares strict input checks across ERC-8004 evidence, policies, GitHub files, and wallet plans.
import { getAddress, type Address } from 'viem';
import { EvidenceError, insist } from './errors';
export const VERSION = '0.3.0';
export function strictJson(raw: string, maxBytes = 4096): unknown {
  insist(typeof raw === 'string' && new TextEncoder().encode(raw).length <= maxBytes);
  try {
    const result: unknown = JSON.parse(raw);
    const stack: (Set<string> | null)[] = [];
    for (const token of raw.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]]/g)) {
      const text = token[0];
      if (text === '{' || text === '[') { stack.push(text === '{' ? new Set() : null); insist(stack.length <= 16); }
      else if (text === '}' || text === ']') stack.pop();
      else if (/^\s*:/.test(raw.slice(token.index + text.length))) {
        const keys = stack.at(-1); insist(keys);
        const key = JSON.parse(text) as string; insist(!keys.has(key)); keys.add(key);
      }
    }
    return result;
  } catch (error) { if (error instanceof EvidenceError) throw error; throw new EvidenceError('invalid_format'); }
}
export function object(value: unknown): Record<string, unknown> {
  insist(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
export function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  insist(Object.keys(value).sort().join('|') === [...keys].sort().join('|'));
}
export function uint(value: unknown, bits = 256): string {
  insist(typeof value === 'string' && /^(0|[1-9][0-9]*)(?![\s\S])/.test(value) && value.length <= 78);
  insist(BigInt(value) < 1n << BigInt(bits));
  return value;
}
export function address(value: unknown): Address {
  insist(typeof value === 'string' && /^0x[0-9a-fA-F]{40}(?![\s\S])/.test(value) && !/^0x0{40}$/i.test(value));
  try { return getAddress(value); } catch { throw new EvidenceError('invalid_address'); }
}
export function subject(value: unknown): string {
  insist(typeof value === 'string' && /^github:[1-9][0-9]{0,19}(?![\s\S])/.test(value));
  return value;
}
