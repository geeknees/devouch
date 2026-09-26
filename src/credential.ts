// ABOUTME: Defines the versioned EIP-712 endorsement and strict public JSON format.
// ABOUTME: Delegates normalization, hashing, and EOA signature recovery to viem.
import { getAddress, isAddress, recoverTypedDataAddress, type Address, type Hex } from 'viem';
import { normalize } from 'viem/ens';
import { EvidenceError, insist } from './errors';

export const CHAIN_ID = 11155111;
export const TEXT_KEY = 'devouch.vouch';
export const MAX_CREDENTIAL_BYTES = 4096;
export const VERSION = '0.2.0';
export const TYPES = { Endorsement: [
  { name: 'version', type: 'string' }, { name: 'id', type: 'bytes32' },
  { name: 'issuer', type: 'address' }, { name: 'subject', type: 'string' },
  { name: 'scope', type: 'string' }, { name: 'issuedAt', type: 'uint64' },
  { name: 'expiresAt', type: 'uint64' }, { name: 'requestNonce', type: 'bytes32' },
  { name: 'recordName', type: 'string' }, { name: 'resolver', type: 'address' },
  { name: 'recordId', type: 'uint256' }, { name: 'anchorStartBlock', type: 'uint256' },
] } as const;

export type Message = {
  version: '1'; id: Hex; issuer: Address; subject: string; scope: string;
  issuedAt: string; expiresAt: string; requestNonce: Hex;
  recordName: string; resolver: Address; recordId: string; anchorStartBlock: string;
};
export type Credential = { formatVersion: 1; domain: ReturnType<typeof domain>;
  endorsement: { message: Message; signature: Hex } };
export type ParsedCredential = { credential: Credential; message: Message; raw: string };

export function strictJson(raw: string, maxBytes = MAX_CREDENTIAL_BYTES): unknown {
  insist(typeof raw === 'string' && new TextEncoder().encode(raw).length <= maxBytes);
  try {
    const result: unknown = JSON.parse(raw);
    const stack: (Set<string> | null)[] = [];
    // JSON.parse validates syntax; token scanning additionally rejects duplicate object keys.
    const tokens = raw.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]]/g);
    for (const token of tokens) {
      const text = token[0];
      if (text === '{' || text === '[') {
        stack.push(text === '{' ? new Set() : null);
        insist(stack.length <= 16);
      } else if (text === '}' || text === ']') stack.pop();
      else if (/^\s*:/.test(raw.slice(token.index + text.length))) {
        const keys = stack.at(-1);
        insist(keys);
        const key = JSON.parse(text) as string;
        insist(!keys.has(key));
        keys.add(key);
      }
    }
    return result;
  } catch (error) {
    if (error instanceof EvidenceError) throw error;
    throw new EvidenceError('invalid_format');
  }
}

export function object(value: unknown): Record<string, unknown> {
  insist(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
export function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  insist(Object.keys(value).sort().join('|') === [...keys].sort().join('|'));
}
export function uint(value: unknown, bits = 256): string {
  insist(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && value.length <= 78);
  insist(BigInt(value) < (1n << BigInt(bits)));
  return value;
}
export function address(value: unknown): Address {
  insist(typeof value === 'string' && isAddress(value, { strict: true }));
  insist(!/^0x0{40}$/i.test(value));
  return getAddress(value);
}
export function subject(value: unknown): string {
  insist(typeof value === 'string' && /^github:[1-9][0-9]{0,19}$/.test(value));
  return value;
}
export function normalizedName(value: unknown): string {
  insist(typeof value === 'string' && value.length <= 255);
  try { insist(normalize(value) === value); } catch { throw new EvidenceError('invalid_format'); }
  return value;
}
export function validateMessage(input: unknown): Message {
  const m = object(input);
  exactKeys(m, TYPES.Endorsement.map(field => field.name));
  insist(m.version === '1');
  for (const key of ['id', 'requestNonce']) insist(typeof m[key] === 'string' && /^0x[0-9a-f]{64}$/.test(m[key] as string) && !/^0x0+$/.test(m[key] as string));
  address(m.issuer); address(m.resolver); subject(m.subject); normalizedName(m.recordName);
  insist(typeof m.scope === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(m.scope));
  uint(m.issuedAt, 64); uint(m.expiresAt, 64); uint(m.recordId); uint(m.anchorStartBlock);
  insist(BigInt(m.expiresAt as string) > BigInt(m.issuedAt as string));
  insist(BigInt(m.recordId as string) > 0n && BigInt(m.anchorStartBlock as string) > 0n);
  return m as Message;
}
export function domain(m: Message) {
  return { name: 'Devouch', version: '1', chainId: CHAIN_ID, verifyingContract: m.resolver } as const;
}
export function typedData(m: Message) {
  return { domain: domain(m), primaryType: 'Endorsement', types: TYPES,
    message: { ...m, issuedAt: BigInt(m.issuedAt), expiresAt: BigInt(m.expiresAt),
      recordId: BigInt(m.recordId), anchorStartBlock: BigInt(m.anchorStartBlock) } } as const;
}
export async function parseCredential(raw: string): Promise<ParsedCredential> {
  const c = object(strictJson(raw));
  exactKeys(c, ['formatVersion', 'domain', 'endorsement']);
  insist(c.formatVersion === 1);
  const e = object(c.endorsement);
  exactKeys(e, ['message', 'signature']);
  const m = validateMessage(e.message);
  const d = object(c.domain);
  exactKeys(d, ['name', 'version', 'chainId', 'verifyingContract']);
  insist(d.name === 'Devouch' && d.version === '1' && d.chainId === CHAIN_ID);
  insist(address(d.verifyingContract) === address(m.resolver));
  insist(typeof e.signature === 'string' && /^0x[0-9a-fA-F]{130}$/.test(e.signature), 'invalid_signature');
  try {
    const signer = await recoverTypedDataAddress({ ...typedData(m), signature: e.signature as Hex });
    insist(signer === address(m.issuer), 'invalid_signature');
  } catch { throw new EvidenceError('invalid_signature'); }
  return { credential: c as Credential, message: m, raw };
}
