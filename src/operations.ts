// ABOUTME: Builds portable unsigned requests and binds revocation plans to exact published bytes.
// ABOUTME: Shares request validation with the static wallet UI and the local verifier bridge.
import { sha256, toHex } from 'viem';
import { ChainReader, type Publication } from './chain';
import { CHAIN_ID, TEXT_KEY, address, domain, exactKeys, object, parseCredential, subject,
  uint, validateMessage, type Message } from './credential';
import { insist } from './errors';

export type PublishRequest = { formatVersion: 1; operation: 'publish'; domain: ReturnType<typeof domain>;
  message: Message; previousValue: string; snapshot: unknown };
export type RevokeRequest = { formatVersion: 1; operation: 'revoke'; credential: string; credentialDigest: string;
  chainId: number; name: string; resolver: string; recordId: string; key: string; intent: 'clear'; snapshot: unknown };
export const digest = (raw: string) => 'sha256:' + sha256(toHex(raw)).slice(2);

export function publicationHint(value: unknown): Publication {
  const hint = object(value);
  exactKeys(hint, ['chainId', 'transactionHash', 'blockNumber', 'blockHash']);
  insist(hint.chainId === CHAIN_ID, 'publication_mismatch');
  uint(hint.blockNumber);
  for (const key of ['transactionHash', 'blockHash']) insist(typeof hint[key] === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hint[key] as string), 'publication_mismatch');
  return hint as Publication;
}

export async function makeRequest(input: { name: string; issuer: string; subject: string; expiresAt: string }, reader: ChainReader): Promise<PublishRequest> {
  subject(input.subject); address(input.issuer); uint(input.expiresAt, 64);
  const location = await reader.prepare(input.name, address(input.issuer));
  insist(BigInt(input.expiresAt) > BigInt(location.snapshot.block_timestamp), 'invalid_expiry');
  insist(BigInt(input.expiresAt) <= BigInt(location.name_expires_at), 'name_expires_before_endorsement');
  const random = () => toHex(crypto.getRandomValues(new Uint8Array(32)));
  const message = validateMessage({ version: '1', id: random(), requestNonce: random(), issuer: address(input.issuer),
    subject: input.subject, scope: 'oss-contribution', issuedAt: location.snapshot.block_timestamp, expiresAt: input.expiresAt,
    recordName: input.name, resolver: location.resolver, recordId: location.record_id, anchorStartBlock: location.anchor_start_block });
  return { formatVersion: 1, operation: 'publish', domain: domain(message), message,
    previousValue: location.current_value, snapshot: location.snapshot };
}

export async function makeRevoke(raw: string, reader: ChainReader): Promise<RevokeRequest> {
  const parsed = await parseCredential(raw);
  const evidence = await reader.inspect(parsed);
  insist(['valid', 'expired'].includes(evidence.evidence_status) && evidence.current_value === raw,
    evidence.evidence_status === 'revoked' ? 'revoked' : 'publication_mismatch',
    evidence.evidence_status === 'unavailable' ? 'unavailable' : 'invalid');
  const m = parsed.message;
  return { formatVersion: 1, operation: 'revoke', credential: raw, credentialDigest: digest(raw),
    chainId: CHAIN_ID, name: m.recordName, resolver: m.resolver, recordId: m.recordId, key: TEXT_KEY,
    intent: 'clear', snapshot: evidence.snapshot };
}

export function validatePublishRequest(input: unknown): PublishRequest {
  const value = object(input);
  exactKeys(value, ['formatVersion', 'operation', 'domain', 'message', 'previousValue', 'snapshot']);
  insist(value.formatVersion === 1 && value.operation === 'publish');
  const message = validateMessage(value.message), expected = domain(message), actual = object(value.domain);
  exactKeys(actual, Object.keys(expected));
  insist(actual.name === expected.name && actual.version === expected.version && actual.chainId === CHAIN_ID
    && address(actual.verifyingContract) === address(expected.verifyingContract));
  insist(typeof value.previousValue === 'string' && new TextEncoder().encode(value.previousValue).length <= 4096);
  return value as PublishRequest;
}

export async function validateRevokeRequest(input: unknown): Promise<RevokeRequest> {
  const value = object(input);
  exactKeys(value, ['formatVersion', 'operation', 'credential', 'credentialDigest', 'chainId', 'name', 'resolver', 'recordId', 'key', 'intent', 'snapshot']);
  insist(value.formatVersion === 1 && value.operation === 'revoke' && typeof value.credential === 'string');
  const parsed = await parseCredential(value.credential);
  insist(value.credentialDigest === digest(parsed.raw) && value.chainId === CHAIN_ID
    && value.name === parsed.message.recordName && address(value.resolver) === address(parsed.message.resolver)
    && value.recordId === parsed.message.recordId && value.key === TEXT_KEY && value.intent === 'clear');
  return value as RevokeRequest;
}
