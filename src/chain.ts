// ABOUTME: Reads ENSv2 endorsements and their complete bounded histories at one chain snapshot.
// ABOUTME: Refuses unknown implementations, changed bindings, unavailable history, and resurrection.
import { BaseError, ContractFunctionRevertedError, createPublicClient, decodeAbiParameters, decodeEventLog, encodeFunctionData, getAddress, http,
  keccak256, toHex, zeroAddress, type Address, type Hex, type Log } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN_ID, TEXT_KEY, address, parseCredential, type ParsedCredential, type Message } from './credential';
import { DEPLOYMENTS, DEPLOYMENT_BLOCK, ETH_REGISTRY, FACTORY, RESOLVER_IMPL, ROOT_REGISTRY, ROLE_TEXT, USER_REGISTRY_IMPL,
  addressAbi, factoryAbi, implementationMatches, nameParts, registryAbi, resolverAbi, textAbi } from './ens';
import { EvidenceError, insist, type EvidenceStatus } from './errors';
import { RpcUnavailableError } from './rpc-errors';
import { evaluateHistory, order, type Position, type Update } from './history';
import { authorityChanged, summarizePath, type ChainEvent, type NameHop } from './hierarchy';
import { AGENT_KEY, AGENT_PROFILE_KEYS, parseAgentIdentity, type AgentProfileKey } from './agent-namespace';

export type Snapshot = { chain_id: number; block_number: string; block_hash: Hex; block_timestamp: string;
  checked_at: string; confirmations: number };
export type Publication = { chainId: number; transactionHash: Hex; blockNumber: string; blockHash: Hex };
export type ChainEvidence = { evidence_status: EvidenceStatus; reason_codes: string[]; snapshot: Snapshot;
  publication: Publication | null; implementation: Address; current_value: string; hierarchy: ReturnType<typeof summarizePath> };
type Decoded = ChainEvent;
const MAX_BLOCK_SPAN = 250_000n;
const MAX_LOGS = 20_000;
const CONFIRMATIONS = 2;
type NameReadOptions = { latest?: boolean; blockNumber?: bigint };

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
      throw new RpcUnavailableError(error);
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

  private async location(name: string, block: bigint, requireResolver = true) {
    const parts = nameParts(name);
    const labels = name.split('.').reverse(), path: NameHop[] = [];
    const visited = new Set<string>();
    let registry = ROOT_REGISTRY;
    for (let index = 0; index < labels.length; index++) {
      insist(!visited.has(registry.toLowerCase()), 'registry_cycle', 'unavailable');
      visited.add(registry.toLowerCase());
      const label = labels[index]!, labelId = BigInt(keccak256(toHex(label)));
      const state = await this.rpc(() => this.client.readContract({ address: registry, abi: registryAbi,
        functionName: 'getState', args: [labelId], blockNumber: block }));
      insist(index === 0 ? state.status > 0 : state.status === 2, 'name_unavailable', 'missing');
      const subregistry = await this.rpc(() => this.client.readContract({ address: registry, abi: registryAbi,
        functionName: 'getSubregistry', args: [label], blockNumber: block }));
      path.push({ name: labels.slice(0, index + 1).reverse().join('.'), registry, label, labelId, state, subregistry });
      if (index < labels.length - 1) {
        if (index === 0) insist(subregistry.toLowerCase() === ETH_REGISTRY.toLowerCase(), 'registry_mismatch');
        else {
          insist(subregistry !== zeroAddress, 'subregistry_missing', 'missing');
          await this.proxy(subregistry, block, USER_REGISTRY_IMPL);
          const parent = await this.rpc(() => this.client.readContract({ address: subregistry, abi: registryAbi,
            functionName: 'getParent', blockNumber: block }));
          insist(parent[0].toLowerCase() === registry.toLowerCase() && parent[1] === label, 'registry_parent_mismatch');
        }
        registry = subregistry;
      }
    }
    const leaf = path.at(-1)!;
    const resolver = await this.rpc(() => this.client.readContract({ address: leaf.registry, abi: registryAbi,
      functionName: 'getResolver', args: [leaf.label], blockNumber: block }));
    if (requireResolver) insist(resolver !== zeroAddress, 'publication_missing', 'missing');
    const expiry = path.reduce((minimum, hop) => hop.state.expiry < minimum ? hop.state.expiry : minimum, leaf.state.expiry);
    return { resolver, state: leaf.state, registry: leaf.registry, path, expiry, ...parts };
  }

  private async proxy(resolver: Address, block: bigint, expected: Address = RESOLVER_IMPL) {
    const implementation = await this.rpc(async () => {
      try { return await this.client.readContract({ address: FACTORY, abi: factoryAbi,
        functionName: 'verifyContract', args: [resolver], blockNumber: block }); }
      catch (error) {
        if (error instanceof BaseError && error.walk(cause => cause instanceof ContractFunctionRevertedError) instanceof ContractFunctionRevertedError) {
          throw new EvidenceError(expected === RESOLVER_IMPL ? 'unsupported_resolver' : 'unsupported_registry', 'unavailable');
        }
        throw error;
      }
    });
    insist(implementation.toLowerCase() === expected.toLowerCase(), 'unsupported_implementation', 'unavailable');
    const logic = await this.rpc(() => this.client.readContract({ address: FACTORY, abi: factoryAbi,
      functionName: 'proxyLogic', blockNumber: block }));
    const code = await this.rpc(() => this.client.getCode({ address: resolver, blockNumber: block }));
    const prefix = `0x363d3d373d3d3d363d73${logic.slice(2)}5af43d82803e903d91602b57fd5bf3`.toLowerCase();
    insist(code?.length === 156 && code.toLowerCase().startsWith(prefix), 'unsupported_proxy', 'unavailable');
    return implementation;
  }

  private async current(resolver: Address, name: string, block: bigint, key = TEXT_KEY) {
    const { node, dns } = nameParts(name);
    const data = encodeFunctionData({ abi: textAbi, functionName: 'text', args: [node, key] });
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
        if (error instanceof RpcUnavailableError && ['rate_limited', 'history_unavailable', 'timeout'].includes(error.rpcIssue)) throw error;
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

  private async registryEvents(registry: Address, block: bigint) {
    const origin = await this.origin(registry, block);
    const deployments = this.decode(await this.logs([FACTORY], origin, origin)).filter(event =>
      event.name === 'ProxyDeployed' && String(event.args.proxyAddress).toLowerCase() === registry.toLowerCase());
    insist(deployments.length === 1 && String(deployments[0]!.args.implementation).toLowerCase() === USER_REGISTRY_IMPL.toLowerCase(),
      'unsupported_registry_history', 'unavailable');
    await this.proxy(registry, origin, USER_REGISTRY_IMPL);
    const history = this.decode(await this.logs([registry], origin, block));
    const upgrades = history.filter(event => event.name === 'Upgraded');
    insist(upgrades.length === 1 && upgrades[0]!.blockNumber === origin
      && String(upgrades[0]!.args.implementation).toLowerCase() === USER_REGISTRY_IMPL.toLowerCase(), 'registry_upgraded', 'unavailable');
    return history;
  }

  private async registryHistory(path: NameHop[], block: bigint) {
    const events: Decoded[] = [];
    for (const registry of new Set(path.slice(2).map(hop => hop.registry))) events.push(...await this.registryEvents(registry, block));
    return events;
  }

  async inspectName(name: string, options: NameReadOptions = {}) {
    let snapshot = await this.snapshot();
    const head = BigInt(snapshot.block_number) + BigInt(CONFIRMATIONS);
    const block = options.blockNumber ?? (options.latest ? head : BigInt(snapshot.block_number));
    insist(block <= head, 'snapshot_unavailable', 'unavailable');
    if (block !== BigInt(snapshot.block_number)) {
      const selected = await this.rpc(() => this.client.getBlock({ blockNumber: block }));
      snapshot = { ...snapshot, block_number: block.toString(), block_hash: selected.hash,
        block_timestamp: selected.timestamp.toString(), confirmations: Number(head - block) };
    }
    await this.checkProtocol(block);
    const location = await this.location(name, block, false);
    await this.registryHistory(location.path, block);
    await this.stable(snapshot);
    return { ...location, snapshot };
  }

  async inspectSubregistry(name: string, registry: Address, allowUnbound = false, options: NameReadOptions = {}) {
    const location = await this.inspectName(name, options);
    const block = BigInt(location.snapshot.block_number);
    insist(!location.path.some(hop => hop.registry.toLowerCase() === registry.toLowerCase()), 'registry_cycle', 'unavailable');
    await this.proxy(registry, block, USER_REGISTRY_IMPL);
    await this.registryEvents(registry, block);
    const parent = await this.rpc(() => this.client.readContract({ address: registry, abi: registryAbi,
      functionName: 'getParent', blockNumber: block }));
    insist((allowUnbound && parent[0] === zeroAddress && parent[1] === '')
      || (parent[0].toLowerCase() === location.registry.toLowerCase() && parent[1] === location.label), 'registry_parent_mismatch');
    await this.stable(location.snapshot);
    return { location, registry, parent };
  }

  async readAgent(name: string, options: NameReadOptions = {}) {
    const location = await this.inspectName(name, options);
    const publishing = await this.prepare(name, location.state.latestOwner, { blockNumber: BigInt(location.snapshot.block_number) });
    const block = BigInt(publishing.snapshot.block_number);
    const identity = parseAgentIdentity(await this.current(publishing.resolver, name, block, AGENT_KEY), name, location.state.latestOwner);
    const parts = nameParts(name);
    // Text-key grants span the resolver. A shared resolver cannot provide one-agent isolation.
    const links = this.decode(await this.logs([publishing.resolver], BigInt(publishing.anchor_start_block), block))
      .filter(event => event.name === 'Linked');
    insist(links.length > 0 && links.every(event => event.args.node === parts.node
      && event.args.recordId === BigInt(publishing.record_id)), 'agent_resolver_shared');
    const encoded = await this.rpc(() => this.client.readContract({ address: publishing.resolver, abi: resolverAbi,
      functionName: 'resolve', args: [parts.dns, encodeFunctionData({ abi: addressAbi, functionName: 'addr', args: [parts.node, 60n] })], blockNumber: block }));
    const wallet = decodeAbiParameters([{ type: 'bytes' }], encoded)[0];
    insist(address(wallet) === identity.wallet, 'agent_identity_mismatch');
    const permissions = {} as Record<AgentProfileKey, boolean>;
    const profile = {} as Record<AgentProfileKey, string>;
    for (const key of AGENT_PROFILE_KEYS) {
      permissions[key] = await this.rpc(() => this.client.readContract({ address: publishing.resolver, abi: resolverAbi,
        functionName: 'hasRoles', args: [BigInt(keccak256(toHex(key))), ROLE_TEXT, identity.wallet], blockNumber: block }));
      profile[key] = await this.current(publishing.resolver, name, block, key);
    }
    await this.stable(publishing.snapshot);
    return { identity, permissions, profile, resolver: publishing.resolver, hierarchy: publishing.hierarchy,
      snapshot: publishing.snapshot, human_verification: 'not_included' as const };
  }

  async prepare(name: string, issuer: Address, options: NameReadOptions = {}) {
    const location = await this.inspectName(name, options);
    const snapshot = location.snapshot;
    const block = BigInt(snapshot.block_number);
    insist(location.resolver !== zeroAddress, 'publication_missing', 'missing');
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
      name_expires_at: location.expiry.toString(), current_value: current, implementation: RESOLVER_IMPL,
      hierarchy: summarizePath(location.path), snapshot };
  }

  async assertWritable(m: Message, expected: string, signer: Address, publishing: boolean) {
    await this.snapshot();
    const latest = await this.rpc(() => this.client.getBlock({ blockTag: 'latest' }));
    await this.checkProtocol(latest.number);
    const location = await this.location(m.recordName, latest.number);
    await this.registryHistory(location.path, latest.number);
    await this.proxy(m.resolver, latest.number);
    const record = await this.rpc(() => this.client.readContract({ address: m.resolver, abi: resolverAbi,
      functionName: 'getRecordId', args: [location.node], blockNumber: latest.number }));
    const current = await this.current(m.resolver, m.recordName, latest.number);
    insist(address(location.resolver) === address(m.resolver) && record === BigInt(m.recordId)
      && current === expected && address(location.state.latestOwner) === address(m.issuer), 'publication_changed');
    if (publishing) {
      insist(address(signer) === address(m.issuer), 'wallet_mismatch');
      insist(BigInt(m.expiresAt) > latest.timestamp && BigInt(m.expiresAt) <= location.expiry, 'expired', 'expired');
    }
    return { block: latest.number, current };
  }

  private recordRelinked(events: Decoded[], publication: Position, m: Message): boolean {
    const { node } = nameParts(m.recordName);
    return events.some(event => order(event, publication) > 0 && event.address.toLowerCase() === m.resolver.toLowerCase()
      && event.name === 'Linked' && event.args.node === node);
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
    let path: NameHop[] = [];
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
      path = atPublication.path;
      const hierarchyEvents = await this.registryHistory(path, block);
      const authorized = await this.rpc(() => this.client.readContract({ address: m.resolver, abi: resolverAbi,
        functionName: 'hasRootRoles', args: [ROLE_TEXT, address(m.issuer)], blockNumber: first.blockNumber }));
      insist(authorized, 'issuer_cannot_publish');
      insist(getAddress(atPublication.resolver) === address(m.resolver) && getAddress(atPublication.state.latestOwner) === address(m.issuer), 'publication_mismatch');
      insist(BigInt(m.expiresAt) <= atPublication.expiry, 'name_expires_before_endorsement');
      // Reusing an ID or nonce for different bytes in this resolver/record is not reissuance.
      for (const prior of updates.filter(e => order(e, first) < 0 && e.value && e.value !== parsed.raw)) {
        try {
          const other = await parseCredential(prior.value);
          if (address(other.message.issuer) === address(m.issuer)
            && (other.message.id === m.id || other.message.requestNonce === m.requestNonce)) status = 'invalid';
        } catch { /* Invalid text cannot invent a signed identifier collision. */ }
      }
      if (status === 'valid') {
        if (this.recordRelinked(events, first, m) || authorityChanged([...events, ...hierarchyEvents], first, m, path)) status = 'invalid';
        else if (BigInt(m.expiresAt) <= BigInt(snapshot.block_timestamp)) status = 'expired';
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
      snapshot, publication, implementation: RESOLVER_IMPL, current_value: current, hierarchy: summarizePath(path) };
  }

  async fetch(name: string, publication?: Publication) {
    const result = await this.verifyName(name, publication);
    return { raw: result.raw, publication: result.publication, snapshot: result.snapshot, subject: result.subject };
  }

  async verifyName(name: string, publication?: Publication) {
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
    return { raw, publication: publication ?? inspected.publication, snapshot: inspected.snapshot,
      subject: parsed.message.subject, parsed, evidence: inspected };
  }
}
