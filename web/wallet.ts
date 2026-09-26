// ABOUTME: Connects an injected wallet to ENSv2 publication, namespaces, permissions, and recovery.
// ABOUTME: Verifies receipts and readback before declaring a transaction complete.
import { createPublicClient, createWalletClient, custom, decodeAbiParameters, encodeFunctionData, getAddress,
  http, keccak256, parseEventLogs, toHex, zeroAddress, type Address, type EIP1193Provider, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN_ID, TEXT_KEY, address, domain, parseCredential, typedData, uint } from '../src/credential';
import { ChainReader } from '../src/chain';
import { AGENT_OWNER_ROLES, FACTORY, OWNER_ROLES, REGISTRY_OWNER_ROLES, REGISTRY_ROLES, RESOLVER_IMPL, ROLE_TEXT, USER_REGISTRY_IMPL,
  factoryAbi, nameParts, registryAbi, resolverAbi, setTextData, textAbi } from '../src/ens';
import { insist } from '../src/errors';
import { validatePublishRequest, validateRevokeRequest, type PublishRequest, type RevokeRequest } from '../src/operations';
import { Submission, validatePending, type Pending } from './submission';
import { AGENT_KEY, makeAgentIdentity, profileKey } from '../src/agent-namespace';

export class WalletSession {
  account: Address | null = null;
  readonly publicClient;
  readonly wallet;
  readonly reader;
  constructor(rpcUrl: string, provider: EIP1193Provider, readonly submission: Submission) {
    this.publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl, { retryCount: 0, timeout: 10000 }), ccipRead: false });
    this.wallet = createWalletClient({ chain: sepolia, transport: custom(provider) });
    this.reader = new ChainReader(rpcUrl);
  }
  async connect() {
    const accounts = await this.wallet.requestAddresses();
    insist(accounts[0], 'wallet_unavailable');
    this.account = getAddress(accounts[0]);
    if (await this.wallet.getChainId() !== CHAIN_ID) await this.wallet.switchChain({ id: CHAIN_ID });
    await this.checkWallet();
    return this.account;
  }
  private async checkWallet() {
    insist(this.account && await this.wallet.getChainId() === CHAIN_ID && await this.publicClient.getChainId() === CHAIN_ID, 'chain_mismatch');
    const accounts = await this.wallet.getAddresses();
    insist(accounts[0] && address(accounts[0]) === address(this.account), 'wallet_changed');
  }
  async sign(request: PublishRequest) {
    validatePublishRequest(request);
    await this.checkWallet();
    await this.reader.assertWritable(request.message, request.previousValue, this.account!, true);
    const signature = await this.wallet.signTypedData({ ...typedData(request.message), account: this.account! });
    const raw = JSON.stringify({ formatVersion: 1, domain: domain(request.message), endorsement: { message: request.message, signature } });
    await parseCredential(raw);
    return raw;
  }
  async publish(request: PublishRequest, raw: string) {
    validatePublishRequest(request);
    const parsed = await parseCredential(raw);
    insist(JSON.stringify(parsed.message) === JSON.stringify(request.message), 'request_changed');
    await this.checkWallet();
    await this.reader.assertWritable(parsed.message, request.previousValue, this.account!, true);
    return this.send({ kind: 'publish', name: parsed.message.recordName, to: parsed.message.resolver,
      data: setTextData(parsed.message.recordName, raw), raw, recordId: parsed.message.recordId, value: raw, account: this.account! });
  }
  async revoke(request: RevokeRequest) {
    await validateRevokeRequest(request);
    await this.checkWallet();
    const parsed = await parseCredential(request.credential);
    await this.reader.assertWritable(parsed.message, request.credential, this.account!, false);
    return this.send({ kind: 'revoke', name: request.name, to: parsed.message.resolver, data: setTextData(request.name, ''),
      raw: request.credential, recordId: request.recordId, value: '', account: this.account! });
  }
  private async owner(name: string) {
    await this.checkWallet();
    const location = await this.reader.inspectName(name, { latest: true });
    insist(address(location.state.latestOwner) === address(this.account), 'issuer_does_not_control_name');
    return location;
  }
  async deploy(name: string, agent?: { subject: string; wallet: Address }) {
    await this.owner(name);
    const calls = [setTextData(name, '')];
    if (agent) {
      const identity = makeAgentIdentity(name, this.account!, agent.subject, agent.wallet);
      calls.push(setTextData(name, JSON.stringify(identity), AGENT_KEY));
      calls.push(encodeFunctionData({ abi: resolverAbi, functionName: 'setAddress', args: [nameParts(name).dns, 60n, identity.wallet] }));
    }
    const init = encodeFunctionData({ abi: resolverAbi, functionName: 'initialize',
      args: [[{ account: this.account!, roleBitmap: agent ? AGENT_OWNER_ROLES : OWNER_ROLES }], calls] });
    const data = encodeFunctionData({ abi: factoryAbi, functionName: 'deployProxy',
      args: [RESOLVER_IMPL, BigInt(toHex(crypto.getRandomValues(new Uint8Array(32)))), init] });
    return this.send({ kind: 'deploy', name, to: FACTORY, data, account: this.account! });
  }
  async bind(name: string, resolver: Address) {
    const parts = await this.owner(name);
    const implementation = await this.publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'verifyContract', args: [resolver] });
    insist(address(implementation) === address(RESOLVER_IMPL), 'unsupported_implementation');
    const owns = await this.publicClient.readContract({ address: resolver, abi: resolverAbi, functionName: 'hasRootRoles', args: [ROLE_TEXT, this.account!] });
    insist(owns, 'issuer_cannot_publish');
    return this.send({ kind: 'bind', name, to: parts.registry,
      data: encodeFunctionData({ abi: registryAbi, functionName: 'setResolver', args: [parts.labelId, resolver] }),
      value: resolver, account: this.account! });
  }
  async helper(name: string, helper: Address, grant: boolean) {
    await this.owner(name);
    const location = await this.reader.prepare(name, this.account!);
    const data = grant
      ? encodeFunctionData({ abi: resolverAbi, functionName: 'grantSetterRoles', args: [setTextData(name, ''), helper] })
      : encodeFunctionData({ abi: resolverAbi, functionName: 'revokeRoles', args: [BigInt(keccak256(toHex(TEXT_KEY))), ROLE_TEXT, helper] });
    return this.send({ kind: grant ? 'grant' : 'remove', name, to: location.resolver, data, helper, account: this.account! });
  }

  async deployRegistry(name: string) {
    await this.owner(name);
    const init = encodeFunctionData({ abi: registryAbi, functionName: 'initialize',
      args: [[{ account: this.account!, roleBitmap: REGISTRY_OWNER_ROLES }]] });
    return this.send({ kind: 'deploy-registry', name, to: FACTORY,
      data: encodeFunctionData({ abi: factoryAbi, functionName: 'deployProxy',
        args: [USER_REGISTRY_IMPL, BigInt(toHex(crypto.getRandomValues(new Uint8Array(32)))), init] }), account: this.account! });
  }

  async parentRegistry(name: string, registry: Address) {
    const owned = await this.owner(name);
    await this.reader.inspectSubregistry(name, registry, true, { latest: true });
    return this.send({ kind: 'parent-registry', name, to: registry,
      data: encodeFunctionData({ abi: registryAbi, functionName: 'setParent', args: [owned.registry, owned.label] }),
      value: owned.registry, account: this.account! });
  }

  async bindRegistry(name: string, registry: Address) {
    const owned = await this.owner(name);
    insist(owned.path.at(-1)!.subregistry === zeroAddress, 'subregistry_already_connected');
    await this.reader.inspectSubregistry(name, registry, false, { latest: true });
    const controls = await this.publicClient.readContract({ address: registry, abi: registryAbi,
      functionName: 'hasRootRoles', args: [REGISTRY_ROLES.register, this.account!] });
    insist(controls, 'namespace_permission_missing');
    return this.send({ kind: 'bind-registry', name, to: owned.registry,
      data: encodeFunctionData({ abi: registryAbi, functionName: 'setSubregistry', args: [owned.labelId, registry] }),
      value: registry, account: this.account! });
  }

  async registerName(parent: string, label: string, expiresAt: string) {
    const owned = await this.owner(parent);
    const name = `${label}.${parent}`, parts = nameParts(name);
    insist(parts.label === label, 'invalid_namespace_label');
    const expiry = BigInt(uint(expiresAt, 64));
    insist(expiry > BigInt(owned.snapshot.block_timestamp) && expiry <= owned.expiry, 'invalid_expiry');
    const registry = owned.path.at(-1)!.subregistry;
    insist(registry !== zeroAddress, 'subregistry_missing', 'missing');
    await this.reader.inspectSubregistry(parent, registry, false, { latest: true });
    const state = await this.publicClient.readContract({ address: registry, abi: registryAbi,
      functionName: 'getState', args: [parts.labelId] });
    insist(state.status === 0, 'name_already_registered');
    return this.send({ kind: 'register-name', name, to: registry,
      data: encodeFunctionData({ abi: registryAbi, functionName: 'register',
        args: [label, this.account!, zeroAddress, zeroAddress, REGISTRY_OWNER_ROLES, expiry] }),
      value: expiresAt, account: this.account! });
  }

  async agentPermission(name: string, agent: Address, key: string, grant: boolean) {
    profileKey(key);
    await this.owner(name);
    const found = await this.reader.readAgent(name, { latest: true });
    insist(found.identity.wallet === address(agent), 'agent_identity_mismatch');
    const data = grant
      ? encodeFunctionData({ abi: resolverAbi, functionName: 'grantSetterRoles', args: [setTextData(name, '', key), agent] })
      : encodeFunctionData({ abi: resolverAbi, functionName: 'revokeRoles', args: [BigInt(keccak256(toHex(key))), ROLE_TEXT, agent] });
    return this.send({ kind: grant ? 'grant-profile' : 'remove-profile', name, to: found.resolver,
      data, key, helper: agent, account: this.account! });
  }

  async updateAgentProfile(name: string, key: string, value: string) {
    profileKey(key); await this.checkWallet();
    insist(new TextEncoder().encode(value).length <= 2048, 'invalid_format');
    const found = await this.reader.readAgent(name, { latest: true });
    const allowed = await this.publicClient.readContract({ address: found.resolver, abi: resolverAbi,
      functionName: 'hasRoles', args: [BigInt(keccak256(toHex(key))), ROLE_TEXT, this.account!] });
    insist(allowed, 'agent_permission_missing');
    return this.send({ kind: 'profile', name, to: found.resolver,
      data: setTextData(name, value, key), value, key, account: this.account! });
  }
  private async send(draft: Pending) {
    insist(!this.submission.pending, 'pending_transaction');
    await this.publicClient.call({ account: this.account!, to: draft.to, data: draft.data });
    const hash = await this.submission.submit(draft, () => this.wallet.sendTransaction({ account: this.account!, to: draft.to, data: draft.data }));
    return this.recover(hash);
  }
  async recover(hash: Hex) {
    const pending = this.submission.pending;
    insist(pending && /^0x[0-9a-fA-F]{64}$/.test(hash), 'invalid_recovery');
    validatePending(pending);
    insist(await this.publicClient.getChainId() === CHAIN_ID, 'chain_mismatch');
    if (pending.hash) insist(hash.toLowerCase() === pending.hash.toLowerCase(), 'transaction_mismatch');
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, timeout: 60000 });
    const transaction = await this.publicClient.getTransaction({ hash });
    const block = await this.publicClient.getBlock({ blockNumber: receipt.blockNumber });
    insist(block.hash === receipt.blockHash && transaction.blockHash === receipt.blockHash, 'snapshot_reorganized', 'unavailable');
    insist(transaction.to && address(transaction.to) === address(pending.to) && transaction.input.toLowerCase() === pending.data.toLowerCase()
      && (!pending.account || address(transaction.from) === address(pending.account)), 'transaction_mismatch');
    if (receipt.status !== 'success') { this.submission.complete(); throw new Error('transaction_reverted'); }
    let resolver: Address | undefined, registry: Address | undefined;
    if (pending.kind === 'publish' || pending.kind === 'revoke') {
      const events = parseEventLogs({ abi: resolverAbi, eventName: 'TextUpdated', logs: receipt.logs });
      insist(events.some(event => address(event.address) === address(pending.to) && event.args.recordId.toString() === pending.recordId
        && event.args.key === TEXT_KEY && event.args.value === pending.value), 'publication_mismatch');
      const parts = nameParts(pending.name);
      const read = await this.publicClient.readContract({ address: pending.to, abi: resolverAbi, functionName: 'resolve',
        args: [parts.dns, encodeFunctionData({ abi: textAbi, functionName: 'text', args: [parts.node, TEXT_KEY] })], blockNumber: receipt.blockNumber });
      insist(decodeAbiParameters([{ type: 'string' }], read)[0] === pending.value, 'publication_mismatch');
    } else if (pending.kind === 'deploy' || pending.kind === 'deploy-registry') {
      const events = parseEventLogs({ abi: factoryAbi, eventName: 'ProxyDeployed', logs: receipt.logs });
      const created = events.find(event => address(event.address) === address(FACTORY)
        && address(event.args.implementation) === address(pending.kind === 'deploy' ? RESOLVER_IMPL : USER_REGISTRY_IMPL)
        && address(event.args.sender) === address(pending.account));
      insist(created, 'deployment_mismatch');
      if (pending.kind === 'deploy') resolver = created.args.proxyAddress;
      else registry = created.args.proxyAddress;
    } else if (pending.kind === 'bind' || pending.kind === 'bind-registry') {
      const location = await this.reader.inspectName(pending.name, { blockNumber: receipt.blockNumber });
      insist(address(location.registry) === address(pending.to), 'publication_mismatch');
      const actual = await this.publicClient.readContract({ address: pending.to, abi: registryAbi,
        functionName: pending.kind === 'bind' ? 'getResolver' : 'getSubregistry',
        args: [nameParts(pending.name).label], blockNumber: receipt.blockNumber });
      insist(address(actual) === address(pending.value), 'publication_mismatch');
    } else if (pending.kind === 'parent-registry') {
      const location = await this.reader.inspectName(pending.name, { blockNumber: receipt.blockNumber });
      insist(address(location.registry) === address(pending.value), 'publication_mismatch');
      await this.reader.inspectSubregistry(pending.name, pending.to, false, { blockNumber: receipt.blockNumber });
    } else if (pending.kind === 'register-name') {
      const location = await this.reader.inspectName(pending.name, { blockNumber: receipt.blockNumber });
      insist(address(location.registry) === address(pending.to) && address(location.state.latestOwner) === address(pending.account)
        && location.state.expiry.toString() === pending.value, 'publication_mismatch');
    } else if (pending.kind === 'profile') {
      const location = await this.reader.inspectName(pending.name, { blockNumber: receipt.blockNumber });
      insist(address(location.resolver) === address(pending.to), 'publication_mismatch');
      const parts = nameParts(pending.name);
      const encoded = await this.publicClient.readContract({ address: pending.to, abi: resolverAbi,
        functionName: 'resolve', args: [parts.dns, encodeFunctionData({ abi: textAbi, functionName: 'text', args: [parts.node, pending.key!] })],
        blockNumber: receipt.blockNumber });
      insist(decodeAbiParameters([{ type: 'string' }], encoded)[0] === pending.value, 'publication_mismatch');
    } else {
      if (pending.kind === 'grant-profile' || pending.kind === 'remove-profile') {
        const location = await this.reader.inspectName(pending.name, { blockNumber: receipt.blockNumber });
        insist(address(location.resolver) === address(pending.to), 'publication_mismatch');
      }
      const granted = await this.publicClient.readContract({ address: pending.to, abi: resolverAbi, functionName: 'hasRoles',
        args: [BigInt(keccak256(toHex(pending.key ?? TEXT_KEY))), ROLE_TEXT, pending.helper!], blockNumber: receipt.blockNumber });
      insist(granted === (pending.kind === 'grant' || pending.kind === 'grant-profile'), 'permission_mismatch');
    }
    this.submission.complete();
    return { receipt, resolver, registry, pending, publication: { chainId: CHAIN_ID, transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash } };
  }
}
