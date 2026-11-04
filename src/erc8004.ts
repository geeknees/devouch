// ABOUTME: Reads one ERC-8004 third-party feedback at a fixed block with its committed application data.
// ABOUTME: Separates registry evidence from repository trust and rejects missing history or changed authority.
import { createPublicClient, getAddress, http, keccak256, parseAbi, parseEventLogs, sha256, stringToHex,
  type Address, type Hex, type PublicClient } from 'viem';
import { exactKeys, object, strictJson } from './json';
import { EvidenceError, insist, type EvidenceStatus } from './errors';

export const identityAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function isAuthorizedOrOwner(address spender, uint256 agentId) view returns (bool)',
  'function getMetadata(uint256 agentId, string metadataKey) view returns (bytes)',
  'function setMetadata(uint256 agentId, string metadataKey, bytes metadataValue)',
  'function register() returns (uint256 agentId)',
  'function approve(address to, uint256 tokenId)',
  'function setApprovalForAll(address operator, bool approved)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
  'event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)',
  'event Upgraded(address indexed implementation)',
]);
export const reputationAbi = parseAbi([
  'function getIdentityRegistry() view returns (address)',
  'function getLastIndex(uint256 agentId, address clientAddress) view returns (uint64)',
  'function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)',
  'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
  'function revokeFeedback(uint256 agentId, uint64 feedbackIndex)',
  'event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
  'event Upgraded(address indexed implementation)',
]);
export const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
export const MAPPING_KEY = 'devouch.github';
const DATA_PREFIX = 'data:application/json;base64,';
export const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const validAddress = (v: unknown): v is Address => typeof v === 'string' && /^0x[0-9a-fA-F]{40}(?![\s\S])/.test(v) && !/^0x0{40}$/.test(v);
export const validHash = (v: unknown): v is Hex => typeof v === 'string' && /^0x[0-9a-fA-F]{64}(?![\s\S])/.test(v);
const uint = (v: unknown, bits = 256): v is string => typeof v === 'string' && /^(0|[1-9][0-9]*)(?![\s\S])/.test(v)
  && v.length <= 78 && BigInt(v) < 2n ** BigInt(bits);
export type FeedbackReference = { format: 'devouch-erc8004-v1'; chainId: number; identityRegistry: Address;
  reputationRegistry: Address; agentId: string; clientAddress: Address; feedbackIndex: string; feedbackBlock: string };
export type FeedbackData = { format: 'devouch-feedback-v1'; subject: string; owner: Address; scope: string;
  issuedAt: string; expiresAt: string };
export type RegistryPin = { identityRegistry: string; reputationRegistry: string;
  identityImplementation: string; reputationImplementation: string; identityCodeHash: string;
  reputationCodeHash: string; identityProxyCodeHash: string; reputationProxyCodeHash: string };
export type FeedbackEvidence = { evidence_status: EvidenceStatus; reason_codes: string[]; chainId?: number;
  issuer?: string; subject?: string; scope?: string; registry?: RegistryPin;
  snapshot?: { blockNumber: string; blockHash: string; timestamp: string };
  feedback?: { value: string; valueDecimals: number; tag1: string; tag2: string; transactionHash: string };
  declaration?: { authority: 'feedback_issuer_and_agent_controller'; account_ownership: 'not_verified'; owner: string } };

export function parseFeedbackReference(raw: string): FeedbackReference {
  const r = object(strictJson(raw, 4096));
  insist(r.formatVersion !== 1, 'legacy_ens_credential');
  exactKeys(r, ['format', 'chainId', 'identityRegistry', 'reputationRegistry', 'agentId', 'clientAddress', 'feedbackIndex', 'feedbackBlock']);
  insist(r.format === 'devouch-erc8004-v1' && Number.isSafeInteger(r.chainId) && Number(r.chainId) > 0);
  insist(validAddress(r.identityRegistry) && validAddress(r.reputationRegistry) && validAddress(r.clientAddress));
  insist(uint(r.agentId) && uint(r.feedbackIndex, 64) && r.feedbackIndex !== '0' && uint(r.feedbackBlock, 64));
  return r as FeedbackReference;
}

export function parseFeedbackData(raw: string): FeedbackData {
  const d = object(strictJson(raw, 4096));
  exactKeys(d, ['format', 'subject', 'owner', 'scope', 'issuedAt', 'expiresAt']);
  insist(d.format === 'devouch-feedback-v1' && validAddress(d.owner));
  insist(typeof d.subject === 'string' && /^github:[1-9][0-9]{0,19}(?![\s\S])/.test(d.subject));
  insist(typeof d.scope === 'string' && /^[a-z][a-z0-9-]{0,63}(?![\s\S])/.test(d.scope));
  insist(uint(d.issuedAt, 64) && uint(d.expiresAt, 64) && BigInt(d.expiresAt) > BigInt(d.issuedAt));
  insist(BigInt(d.expiresAt) - BigInt(d.issuedAt) <= 366n * 86400n, 'lifetime_too_long');
  return d as FeedbackData;
}

export function feedbackDataURI(raw: string): string {
  parseFeedbackData(raw);
  return DATA_PREFIX + btoa(String.fromCharCode(...new TextEncoder().encode(raw)));
}

function readDataURI(uri: string): string {
  insist(uri.length <= 6000 && uri.startsWith(DATA_PREFIX), 'feedback_data_unavailable', 'unavailable');
  try {
    const encoded = uri.slice(DATA_PREFIX.length);
    insist(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?(?![\s\S])/.test(encoded));
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)));
  } catch { throw new EvidenceError('invalid_feedback_data'); }
}

export class Erc8004Reader {
  readonly client: PublicClient;
  constructor(client: PublicClient | string) {
    this.client = typeof client === 'string' ? createPublicClient({ transport: http(client, { retryCount: 0, timeout: 15000 }) }) : client;
  }

  private async feedback(reference: FeedbackReference) {
    const r = parseFeedbackReference(JSON.stringify(reference));
    const origin = BigInt(r.feedbackBlock);
    const logs = await this.client.getLogs({ address: r.reputationRegistry, fromBlock: origin, toBlock: origin });
    const events = parseEventLogs({ abi: reputationAbi, eventName: 'NewFeedback', logs }).filter(log =>
      log.args.agentId === BigInt(r.agentId) && sameAddress(log.args.clientAddress, r.clientAddress)
      && log.args.feedbackIndex === BigInt(r.feedbackIndex));
    insist(events.length === 1, 'feedback_event_missing', 'missing');
    const event = events[0]!, raw = readDataURI(event.args.feedbackURI);
    insist(sha256(stringToHex(raw)) === event.args.feedbackHash.toLowerCase(), 'feedback_hash_mismatch');
    return { event, data: parseFeedbackData(raw) };
  }

  async fetch(reference: FeedbackReference) {
    const r = parseFeedbackReference(JSON.stringify(reference));
    insist(await this.client.getChainId() === r.chainId, 'wrong_chain', 'unavailable');
    const { event, data } = await this.feedback(r);
    return { raw: JSON.stringify(r) + '\n', subject: data.subject, data,
      publication: { blockNumber: r.feedbackBlock, blockHash: event.blockHash, transactionHash: event.transactionHash } };
  }

  async registryPin(identityRegistry: Address, reputationRegistry: Address, blockNumber: bigint): Promise<RegistryPin> {
    const inspect = async (address: Address) => {
      const slot = await this.client.getStorageAt({ address, slot: IMPLEMENTATION_SLOT, blockNumber });
      insist(slot && /^0x0{24}[0-9a-fA-F]{40}$/.test(slot), 'unsupported_registry');
      const implementation = getAddress('0x' + slot.slice(-40));
      insist(validAddress(implementation), 'unsupported_registry');
      const [code, proxy] = await Promise.all([this.client.getCode({ address: implementation, blockNumber }),
        this.client.getCode({ address, blockNumber })]);
      insist(code && code !== '0x' && proxy && proxy !== '0x', 'unsupported_registry');
      return { implementation, codeHash: keccak256(code), proxyCodeHash: keccak256(proxy) };
    };
    const [identity, reputation] = await Promise.all([inspect(identityRegistry), inspect(reputationRegistry)]);
    return { identityRegistry, reputationRegistry, identityImplementation: identity.implementation,
      reputationImplementation: reputation.implementation, identityCodeHash: identity.codeHash,
      reputationCodeHash: reputation.codeHash, identityProxyCodeHash: identity.proxyCodeHash, reputationProxyCodeHash: reputation.proxyCodeHash };
  }

  async inspect(reference: FeedbackReference, subject: string, blockNumber?: bigint): Promise<FeedbackEvidence> {
    let snapshot: FeedbackEvidence['snapshot'];
    try {
      const r = parseFeedbackReference(JSON.stringify(reference));
      const chainId = await this.client.getChainId();
      insist(chainId === r.chainId, 'wrong_chain', 'unavailable');
      const block = await this.client.getBlock(blockNumber === undefined ? { blockTag: 'finalized' } : { blockNumber });
      insist(block.number !== null && block.hash !== null, 'snapshot_unavailable', 'unavailable');
      if (blockNumber === undefined) {
        const now = BigInt(Math.floor(Date.now() / 1000));
        insist(block.timestamp <= now + 300n && block.timestamp >= now - 3600n, 'snapshot_stale', 'unavailable');
      }
      snapshot = { blockNumber: block.number.toString(), blockHash: block.hash, timestamp: block.timestamp.toString() };
      const observed = block.number, origin = BigInt(r.feedbackBlock), agentId = BigInt(r.agentId), index = BigInt(r.feedbackIndex);
      insist(origin <= observed, 'feedback_not_observed', 'missing');
      const connected = await this.client.readContract({ address: r.reputationRegistry, abi: reputationAbi,
        functionName: 'getIdentityRegistry', blockNumber: observed });
      insist(sameAddress(connected, r.identityRegistry), 'registry_mismatch');
      const last = await this.client.readContract({ address: r.reputationRegistry, abi: reputationAbi,
        functionName: 'getLastIndex', args: [agentId, r.clientAddress], blockNumber: observed });
      insist(index <= last, 'feedback_missing', 'missing');
      const { event, data } = await this.feedback(r), f = event.args;
      insist(data.subject === subject, 'subject_mismatch');
      insist(f.tag1 === data.scope && f.tag2 === 'devouch-feedback-v1' && f.value === 1n && f.valueDecimals === 0,
        'unsupported_feedback_semantics');
      const published = await this.client.getBlock({ blockNumber: origin });
      insist(BigInt(data.issuedAt) <= published.timestamp && published.timestamp < BigInt(data.expiresAt), 'invalid_publication_time');
      const current = await this.client.readContract({ address: r.reputationRegistry, abi: reputationAbi,
        functionName: 'readFeedback', args: [agentId, r.clientAddress, index], blockNumber: observed });
      insist(!current[4], 'feedback_revoked', 'revoked');
      insist(current[0] === f.value && current[1] === f.valueDecimals && current[2] === f.tag1 && current[3] === f.tag2,
        'feedback_state_mismatch');
      insist(block.timestamp < BigInt(data.expiresAt), 'feedback_expired', 'expired');
      const registry = await this.registryPin(r.identityRegistry, r.reputationRegistry, observed);
      const initial = await this.registryPin(r.identityRegistry, r.reputationRegistry, origin);
      insist(JSON.stringify(registry) === JSON.stringify(initial), 'registry_changed');
      for (const at of [origin, observed]) {
        const [owner, mapping, authorized] = await Promise.all([
          this.client.readContract({ address: r.identityRegistry, abi: identityAbi, functionName: 'ownerOf', args: [agentId], blockNumber: at }),
          this.client.readContract({ address: r.identityRegistry, abi: identityAbi, functionName: 'getMetadata', args: [agentId, MAPPING_KEY], blockNumber: at }),
          this.client.readContract({ address: r.identityRegistry, abi: identityAbi, functionName: 'isAuthorizedOrOwner', args: [r.clientAddress, agentId], blockNumber: at }),
        ]);
        insist(sameAddress(owner, data.owner), 'owner_changed');
        insist(mapping.toLowerCase() === stringToHex(data.subject).toLowerCase(), 'github_mapping_mismatch');
        insist(!authorized, 'issuer_is_owner_or_operator');
      }
      // Include the publication block conservatively: same-block authority changes require fresh feedback.
      insist(observed - origin <= 2_000_000n, 'history_range_unavailable', 'unavailable');
      for (let from = origin; from <= observed; from += 2000n) {
        const to = from + 1999n < observed ? from + 1999n : observed;
        const [identityLogs, reputationLogs] = await Promise.all([
          this.client.getLogs({ address: r.identityRegistry, fromBlock: from, toBlock: to }),
          this.client.getLogs({ address: r.reputationRegistry, fromBlock: from, toBlock: to }),
        ]);
        for (const log of parseEventLogs({ abi: identityAbi, logs: identityLogs })) {
          if (log.eventName === 'Upgraded') throw new EvidenceError('registry_changed');
          if ((log.eventName === 'Transfer' || log.eventName === 'Approval') && log.args.tokenId === agentId)
            throw new EvidenceError('agent_authority_changed');
          if (log.eventName === 'ApprovalForAll' && sameAddress(log.args.owner, data.owner))
            throw new EvidenceError('agent_authority_changed');
          if (log.eventName === 'MetadataSet' && log.args.agentId === agentId && log.args.metadataKey === MAPPING_KEY)
            throw new EvidenceError('github_mapping_changed');
        }
        insist(!parseEventLogs({ abi: reputationAbi, eventName: 'Upgraded', logs: reputationLogs }).length, 'registry_changed');
      }
      const [end, start] = await Promise.all([this.client.getBlock({ blockNumber: observed }), this.client.getBlock({ blockNumber: origin })]);
      insist(end.hash === block.hash && start.hash === published.hash && event.blockHash === published.hash,
        'snapshot_changed', 'unavailable');
      return { evidence_status: 'valid', reason_codes: [], chainId, issuer: r.clientAddress, subject: data.subject,
        scope: data.scope, registry, snapshot,
        feedback: { value: f.value.toString(), valueDecimals: f.valueDecimals, tag1: f.tag1, tag2: f.tag2, transactionHash: event.transactionHash! },
        declaration: { authority: 'feedback_issuer_and_agent_controller', account_ownership: 'not_verified', owner: data.owner } };
    } catch (error) {
      const failure = error instanceof EvidenceError ? error : new EvidenceError('evidence_unavailable', 'unavailable');
      return { evidence_status: failure.status, reason_codes: [failure.code], ...(snapshot ? { snapshot } : {}) };
    }
  }
}
