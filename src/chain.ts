// ABOUTME: Reads ENSv2 endorsements and their complete bounded histories at one chain snapshot.
// ABOUTME: Refuses unknown implementations, changed bindings, unavailable history, and resurrection.
import { createPublicClient, decodeAbiParameters, decodeEventLog, encodeFunctionData, getAddress, http,
  keccak256, toHex, zeroAddress, type Address, type Hex, type Log } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN_ID, TEXT_KEY, address, parseCredential, type ParsedCredential, type Message } from './credential';
import { DEPLOYMENTS, DEPLOYMENT_BLOCK, ETH_REGISTRY, FACTORY, RESOLVER_IMPL, ROOT_REGISTRY, ROLE_TEXT,
  factoryAbi, implementationMatches, nameParts, registryAbi, resolverAbi, sameLabel, textAbi } from './ens';
import { EvidenceError, insist, type EvidenceStatus } from './errors';
import { evaluateHistory, order, type Position, type Update } from './history';

export type Snapshot = { chain_id: number; block_number: string; block_hash: Hex; block_timestamp: string;
  checked_at: string; confirmations: number };
export type Publication = { chainId: number; transactionHash: Hex; blockNumber: string; blockHash: Hex };
export type ChainEvidence = { evidence_status: EvidenceStatus; reason_codes: string[]; snapshot: Snapshot;
  publication: Publication | null; implementation: Address; current_value: string };
type Decoded = Position & { name: string; args: Record<string, unknown>; address: Address; blockHash: Hex; transactionHash: Hex };
const MAX_BLOCK_SPAN = 250_000n;
const MAX_LOGS = 20_000;
const CONFIRMATIONS = 2;

export class ChainReader {
  readonly client;
  private deadline = 0;
  private queries = 0;
  constructor(rpcUrl: string) {
    const url = new URL(rpcUrl);
    insist(url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)), 'invalid_rpc_url');
    this.client = createPublicClient({ chain: sepolia, ccipRead: false, batch: { multicall: false },
      transport: http(rpcUrl, { timeout: 10000, retryCount: 0 }) });
  }

  private async rpc<T>(call: () => Promise<T>): Promise<T> {
    insist(Date.now() <= this.deadline && ++this.queries <= 1200, 'history_budget_exceeded', 'unavailable');
    try { return await call(); }
    catch (error) {
      if (error instanceof EvidenceError) throw error;
      throw new EvidenceError('rpc_unavailable', 'unavailable');
    }
  }

  async snapshot(): Promise<Snapshot> {
    this.deadline = Date.now() + 90000;
    this.queries = 0;
    const chainId = await this.rpc(() => this.client.getChainId());
    insist(chainId === CHAIN_ID, 'chain_mismatch');
    const latest = await this.rpc(() => this.client.getBlock({ blockTag: 'latest' }));
    insist(latest.number >= BigInt(CONFIRMATIONS), 'snapshot_unavailable', 'unavailable');
    const block = await this.rpc(() => this.client.getBlock({ blockNumber: latest.number - BigInt(CONFIRMATIONS) }));
    const age = BigInt(Math.floor(Date.now() / 1000)) - block.timestamp;
    insist(age <= 300n && age >= -120n, 'stale_snapshot', 'unavailable');
    return { chain_id: CHAIN_ID, block_number: block.number.toString(), block_hash: block.hash,
      block_timestamp: block.timestamp.toString(), checked_at: new Date().toISOString(), confirmations: CONFIRMATIONS };
  }

  private async stable(snapshot: Snapshot) {
    const block = await this.rpc(() => this.client.getBlock({ blockNumber: BigInt(snapshot.block_number) }));
    insist(block.hash === snapshot.block_hash, 'snapshot_reorganized', 'unavailable');
  }

  private async checkProtocol(block: bigint) {
    for (const artifact of Object.values(DEPLOYMENTS)) {
      const code = await this.rpc(() => this.client.getCode({ address: artifact.address as Address, blockNumber: block }));
      insist(implementationMatches(code, artifact), 'unsupported_protocol', 'unavailable');
    }
  }

  private async location(name: string, block: bigint) {
    const parts = nameParts(name);
    const eth = await this.rpc(() => this.client.readContract({ address: ROOT_REGISTRY, abi: registryAbi,
      functionName: 'getSubregistry', args: ['eth'], blockNumber: block }));
    insist(eth.toLowerCase() === ETH_REGISTRY.toLowerCase(), 'registry_mismatch');
    const resolver = await this.rpc(() => this.client.readContract({ address: ETH_REGISTRY, abi: registryAbi,
      functionName: 'getResolver', args: [parts.label], blockNumber: block }));
    insist(resolver !== zeroAddress, 'publication_missing', 'missing');
    const state = await this.rpc(() => this.client.readContract({ address: ETH_REGISTRY, abi: registryAbi,
      functionName: 'getState', args: [parts.labelId], blockNumber: block }));
    insist(state.status === 2, 'name_unavailable', 'missing');
    return { resolver, state, ...parts };
  }

  private async proxy(resolver: Address, block: bigint) {
    let implementation: Address;
    try {
      implementation = await this.rpc(() => this.client.readContract({ address: FACTORY, abi: factoryAbi,
        functionName: 'verifyContract', args: [resolver], blockNumber: block }));
    } catch { throw new EvidenceError('unsupported_resolver', 'unavailable'); }
    insist(implementation.toLowerCase() === RESOLVER_IMPL.toLowerCase(), 'unsupported_implementation', 'unavailable');
    const logic = await this.rpc(() => this.client.readContract({ address: FACTORY, abi: factoryAbi,
      functionName: 'proxyLogic', blockNumber: block }));
    const code = await this.rpc(() => this.client.getCode({ address: resolver, blockNumber: block }));
    const prefix = `0x363d3d373d3d3d363d73${logic.slice(2)}5af43d82803e903d91602b57fd5bf3`.toLowerCase();
    insist(code?.length === 156 && code.toLowerCase().startsWith(prefix), 'unsupported_proxy', 'unavailable');
    return implementation;
  }

  private async current(resolver: Address, name: string, block: bigint) {
    const { node, dns } = nameParts(name);
    const data = encodeFunctionData({ abi: textAbi, functionName: 'text', args: [node, TEXT_KEY] });
    const result = await this.rpc(() => this.client.readContract({ address: resolver, abi: resolverAbi,
      functionName: 'resolve', args: [dns, data], blockNumber: block }));
    try { return decodeAbiParameters([{ type: 'string' }], result)[0]; }
    catch { throw new EvidenceError('invalid_resolver_response', 'unavailable'); }
  }

  private async logs(addresses: Address[], from: bigint, to: bigint): Promise<Log[]> {
    insist(from <= to && to - from <= MAX_BLOCK_SPAN, 'history_budget_exceeded', 'unavailable');
    const result: Log[] = [];
    const range = async (start: bigint, end: bigint): Promise<Log[]> => {
      try { return await this.rpc(() => this.client.getLogs({ address: addresses, fromBlock: start, toBlock: end })); }
      catch (error) {
        if (start === end || Date.now() > this.deadline || this.queries > 1150) throw error;
        const middle = (start + end) / 2n;
        return [...await range(start, middle), ...await range(middle + 1n, end)];
      }
    };
    for (let start = from; start <= to; start += 1000n) {
      const end = start + 999n < to ? start + 999n : to;
      result.push(...await range(start, end));
      insist(result.length <= MAX_LOGS, 'history_budget_exceeded', 'unavailable');
    }
    insist(result.every(log => !log.removed && log.blockNumber !== null && log.blockHash !== null && log.transactionHash !== null && log.logIndex !== null && log.transactionIndex !== null), 'history_inconsistent', 'unavailable');
    const unique = new Set(result.map(log => `${log.blockHash}:${log.logIndex}`));
    insist(unique.size === result.length, 'history_inconsistent', 'unavailable');
    return result;
  }

  private decode(logs: Log[]): Decoded[] {
    const result: Decoded[] = [];
    for (const log of logs) {
      try {
        const event = decodeEventLog({ abi: [...resolverAbi, ...registryAbi, ...factoryAbi], data: log.data, topics: log.topics, strict: true });
        result.push({ name: event.eventName, args: event.args as Record<string, unknown>, address: log.address,
          blockNumber: log.blockNumber!, blockHash: log.blockHash!, transactionHash: log.transactionHash!,
          transactionIndex: log.transactionIndex!, logIndex: log.logIndex! });
      } catch { /* Other official ENS events are irrelevant to endorsement state. */ }
    }
    return result.sort(order);
  }

  private async origin(resolver: Address, block: bigint): Promise<bigint> {
    let low = DEPLOYMENT_BLOCK, high = block;
    // A fresh proxy requires its own deployment history, not unrelated older factory state.
    for (let distance = 1n; ; distance *= 2n) {
      const candidate = block - distance > DEPLOYMENT_BLOCK ? block - distance : DEPLOYMENT_BLOCK;
      const code = await this.rpc(() => this.client.getCode({ address: resolver, blockNumber: candidate }));
      if (!code || code === '0x') { low = candidate + 1n; break; }
      high = candidate;
      if (candidate === DEPLOYMENT_BLOCK) { low = candidate; break; }
    }
    while (low < high) {
      const middle = (low + high) / 2n;
      const code = await this.rpc(() => this.client.getCode({ address: resolver, blockNumber: middle }));
      if (code && code !== '0x') high = middle; else low = middle + 1n;
    }
    return low;
  }

  private async proveOrigin(m: Message, snapshot: Snapshot) {
    const anchor = BigInt(m.anchorStartBlock);
    insist(anchor >= DEPLOYMENT_BLOCK && anchor <= BigInt(snapshot.block_number), 'invalid_anchor');
    const before = await this.rpc(() => this.client.getCode({ address: m.resolver, blockNumber: anchor - 1n }));
    insist(!before || before === '0x', 'invalid_anchor');
    const deployments = this.decode(await this.logs([FACTORY], anchor, anchor)).filter(e =>
      e.name === 'ProxyDeployed' && String(e.args.proxyAddress).toLowerCase() === m.resolver.toLowerCase());
    insist(deployments.length === 1, 'invalid_anchor');
    insist(String(deployments[0]!.args.implementation).toLowerCase() === RESOLVER_IMPL.toLowerCase(), 'unsupported_implementation_history', 'unavailable');
    // The first implementation is pinned. Any subsequent upgrade remains detectable because its
    // first transition must execute that known implementation and emit Upgraded, even if restored.
    await this.proxy(m.resolver, anchor);
  }

  async prepare(name: string, issuer: Address) {
    const snapshot = await this.snapshot();
    const block = BigInt(snapshot.block_number);
    await this.checkProtocol(block);
    const location = await this.location(name, block);
    await this.proxy(location.resolver, block);
    insist(getAddress(location.state.latestOwner) === address(issuer), 'issuer_does_not_control_name');
    const controls = await this.rpc(() => this.client.readContract({ address: location.resolver, abi: resolverAbi,
      functionName: 'hasRootRoles', args: [ROLE_TEXT, issuer], blockNumber: block }));
    insist(controls, 'issuer_cannot_publish');
    const record = await this.rpc(() => this.client.readContract({ address: location.resolver, abi: resolverAbi,
      functionName: 'getRecordId', args: [location.node], blockNumber: block }));
    insist(record > 0n, 'record_not_initialized');
    const origin = await this.origin(location.resolver, block);
    const proxyHistory = this.decode(await this.logs([location.resolver], origin, block)).filter(e => e.name === 'Upgraded');
    insist(proxyHistory.length === 1 && proxyHistory[0]!.blockNumber === origin
      && String(proxyHistory[0]!.args.implementation).toLowerCase() === RESOLVER_IMPL.toLowerCase(), 'resolver_upgraded', 'unavailable');
    const current = await this.current(location.resolver, name, block);
    await this.stable(snapshot);
    return { resolver: location.resolver, record_id: record.toString(), anchor_start_block: origin.toString(),
      name_expires_at: location.state.expiry.toString(), current_value: current, implementation: RESOLVER_IMPL, snapshot };
  }

  async assertWritable(m: Message, expected: string, signer: Address, publishing: boolean) {
    await this.snapshot();
    const latest = await this.rpc(() => this.client.getBlock({ blockTag: 'latest' }));
    await this.checkProtocol(latest.number);
    const location = await this.location(m.recordName, latest.number);
    await this.proxy(m.resolver, latest.number);
    const record = await this.rpc(() => this.client.readContract({ address: m.resolver, abi: resolverAbi,
      functionName: 'getRecordId', args: [location.node], blockNumber: latest.number }));
    const current = await this.current(m.resolver, m.recordName, latest.number);
    insist(address(location.resolver) === address(m.resolver) && record === BigInt(m.recordId)
      && current === expected && address(location.state.latestOwner) === address(m.issuer), 'publication_changed');
    if (publishing) {
      insist(address(signer) === address(m.issuer), 'wallet_mismatch');
      insist(BigInt(m.expiresAt) > latest.timestamp && BigInt(m.expiresAt) <= location.state.expiry, 'expired', 'expired');
    }
    return { block: latest.number, current };
  }

  private bindingChanged(events: Decoded[], publication: Position, m: Message): boolean {
    const { labelId, node } = nameParts(m.recordName);
    const ethId = BigInt(keccak256(toHex('eth')));
    return events.some(e => {
      if (order(e, publication) <= 0) return false;
      if (e.address.toLowerCase() === m.resolver.toLowerCase()) return e.name === 'Linked' && e.args.node === node;
      if (e.address.toLowerCase() === ROOT_REGISTRY.toLowerCase()) return e.name === 'SubregistryUpdated' && sameLabel(e.args.tokenId as bigint, ethId);
      if (e.address.toLowerCase() !== ETH_REGISTRY.toLowerCase()) return false;
      if (['ResolverUpdated', 'LabelRegistered', 'LabelUnregistered'].includes(e.name)) return sameLabel(e.args.tokenId as bigint, labelId);
      if (e.name === 'TransferSingle') return sameLabel(e.args.id as bigint, labelId) && e.args.from !== e.args.to;
      if (e.name === 'TransferBatch') return (e.args.ids as bigint[]).some(id => sameLabel(id, labelId)) && e.args.from !== e.args.to;
      return false;
    });
  }

  private async matchPublication(publication: Publication, event: Update) {
    insist(publication.chainId === CHAIN_ID && publication.blockNumber === event.blockNumber.toString()
      && publication.blockHash === event.blockHash && publication.transactionHash === event.transactionHash, 'publication_mismatch');
    const receipt = await this.rpc(() => this.client.getTransactionReceipt({ hash: event.transactionHash }));
    insist(receipt.status === 'success' && receipt.blockHash === event.blockHash && receipt.blockNumber === event.blockNumber
      && receipt.logs.some(log => log.logIndex === event.logIndex && log.blockHash === event.blockHash), 'publication_mismatch');
    const block = await this.rpc(() => this.client.getBlock({ blockNumber: event.blockNumber }));
    insist(block.hash === event.blockHash, 'snapshot_reorganized', 'unavailable');
    return block;
  }

  async inspect(parsed: ParsedCredential, hint?: Publication): Promise<ChainEvidence> {
    const snapshot = await this.snapshot();
    const block = BigInt(snapshot.block_number), m = parsed.message;
    await this.checkProtocol(block);
    await this.proxy(m.resolver, block);
    await this.proveOrigin(m, snapshot);
    const events = this.decode(await this.logs([m.resolver, ETH_REGISTRY, ROOT_REGISTRY], BigInt(m.anchorStartBlock), block));
    const upgrades = events.filter(e => e.address.toLowerCase() === m.resolver.toLowerCase() && e.name === 'Upgraded');
    insist(upgrades.length === 1 && upgrades[0]!.blockNumber === BigInt(m.anchorStartBlock)
      && String(upgrades[0]!.args.implementation).toLowerCase() === RESOLVER_IMPL.toLowerCase(), 'resolver_upgraded', 'unavailable');
    const current = await this.current(m.resolver, m.recordName, block);
    const updates: Update[] = events.filter(e => e.address.toLowerCase() === m.resolver.toLowerCase()
      && e.name === 'TextUpdated' && e.args.recordId === BigInt(m.recordId) && e.args.key === TEXT_KEY)
      .map(e => ({ ...e, value: e.args.value as string }));
    const currentRecord = await this.rpc(() => this.client.readContract({ address: m.resolver, abi: resolverAbi,
      functionName: 'getRecordId', args: [nameParts(m.recordName).node], blockNumber: block }));
    // After relinking, resolve(name) reads another record; that binding change is checked separately.
    const history = evaluateHistory(parsed.raw, currentRecord === BigInt(m.recordId) ? current : updates.at(-1)?.value ?? '', updates);
    let status: EvidenceStatus = history.status;
    let publication: Publication | null = null;
    if (history.publication) {
      const first = history.publication;
      publication = { chainId: CHAIN_ID, transactionHash: first.transactionHash,
        blockNumber: first.blockNumber.toString(), blockHash: first.blockHash };
      const publishedBlock = await this.matchPublication(publication, first);
      if (hint) {
        // A hint may refer to a later identical write, but never changes the signed history start.
        const hinted = updates.find(e => e.value === parsed.raw && e.transactionHash === hint.transactionHash && e.blockHash === hint.blockHash);
        insist(hinted, 'publication_mismatch');
        await this.matchPublication(hint, hinted);
      }
      insist(BigInt(m.issuedAt) <= publishedBlock.timestamp, 'issued_after_publication');
      const atPublication = await this.location(m.recordName, first.blockNumber);
      insist(getAddress(atPublication.resolver) === address(m.resolver) && getAddress(atPublication.state.latestOwner) === address(m.issuer), 'publication_mismatch');
      insist(BigInt(m.expiresAt) <= atPublication.state.expiry, 'name_expires_before_endorsement');
      // Reusing an ID or nonce for different bytes in this resolver/record is not reissuance.
      for (const prior of updates.filter(e => order(e, first) < 0 && e.value && e.value !== parsed.raw)) {
        try {
          const other = await parseCredential(prior.value);
          if (address(other.message.issuer) === address(m.issuer)
            && (other.message.id === m.id || other.message.requestNonce === m.requestNonce)) status = 'invalid';
        } catch { /* Invalid text cannot invent a signed identifier collision. */ }
      }
      if (status === 'valid') {
        if (this.bindingChanged(events, first, m)) status = 'invalid';
        else {
          const now = await this.location(m.recordName, block);
          const record = await this.rpc(() => this.client.readContract({ address: m.resolver, abi: resolverAbi,
            functionName: 'getRecordId', args: [now.node], blockNumber: block }));
          insist(address(now.resolver) === address(m.resolver) && record === BigInt(m.recordId) && current === parsed.raw
            && address(now.state.latestOwner) === address(m.issuer), 'publication_mismatch');
          insist(BigInt(m.issuedAt) <= BigInt(snapshot.block_timestamp), 'issued_in_future');
          if (BigInt(m.expiresAt) <= BigInt(snapshot.block_timestamp)) status = 'expired';
        }
      }
    } else if (hint) throw new EvidenceError('publication_mismatch');
    await this.stable(snapshot);
    return { evidence_status: status, reason_codes: status === 'valid' ? [] : [status === 'missing' ? 'publication_missing' : status === 'invalid' ? 'publication_mismatch' : status],
      snapshot, publication, implementation: RESOLVER_IMPL, current_value: current };
  }

  async fetch(name: string, publication?: Publication) {
    nameParts(name);
    const snapshot = await this.snapshot(), block = BigInt(snapshot.block_number);
    await this.checkProtocol(block);
    let raw: string;
    let resolver: Address;
    if (publication) {
      insist(publication.chainId === CHAIN_ID && BigInt(publication.blockNumber) <= block, 'publication_mismatch');
      const receipt = await this.rpc(() => this.client.getTransactionReceipt({ hash: publication.transactionHash }));
      insist(receipt.status === 'success' && receipt.blockHash === publication.blockHash && receipt.blockNumber.toString() === publication.blockNumber, 'publication_mismatch');
      const candidates = this.decode(receipt.logs).filter(e => e.name === 'TextUpdated' && e.args.key === TEXT_KEY && e.args.value !== '');
      const matching: { raw: string; event: Decoded }[] = [];
      for (const event of candidates) {
        try {
          const parsed = await parseCredential(event.args.value as string);
          if (parsed.message.recordName === name && address(parsed.message.resolver) === address(event.address)
            && BigInt(parsed.message.recordId) === event.args.recordId) matching.push({ raw: parsed.raw, event });
        } catch { /* Select only a signed endorsement for the requested name. */ }
      }
      insist(matching.length === 1, 'publication_mismatch');
      raw = matching[0]!.raw;
      resolver = matching[0]!.event.address;
    } else {
      const location = await this.location(name, block);
      resolver = location.resolver;
      await this.proxy(resolver, block);
      raw = await this.current(resolver, name, block);
    }
    insist(raw.length > 0, 'publication_missing', 'missing');
    const parsed = await parseCredential(raw);
    insist(parsed.message.recordName === name && address(parsed.message.resolver) === address(resolver), 'publication_mismatch');
    await this.stable(snapshot);
    // This also reconstructs and checks the publication position; it does not apply repo policy.
    const inspected = await this.inspect(parsed, publication);
    insist(inspected.publication, 'publication_missing', 'missing');
    return { raw, publication: publication ?? inspected.publication, snapshot: inspected.snapshot, subject: parsed.message.subject };
  }
}
