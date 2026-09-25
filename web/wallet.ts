// ABOUTME: Connects an injected wallet to direct ENSv2 publication, setup, revocation, and recovery.
// ABOUTME: Verifies receipts and readback before declaring a transaction complete.
import { createPublicClient, createWalletClient, custom, decodeAbiParameters, encodeFunctionData, getAddress,
  http, keccak256, parseEventLogs, toHex, type Address, type EIP1193Provider, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN_ID, TEXT_KEY, address, domain, parseCredential, typedData } from '../src/credential';
import { ChainReader } from '../src/chain';
import { DEPLOYMENTS, ETH_REGISTRY, FACTORY, OWNER_ROLES, RESOLVER_IMPL, ROOT_REGISTRY, ROLE_TEXT,
  factoryAbi, implementationMatches, nameParts, registryAbi, resolverAbi, setTextData, textAbi } from '../src/ens';
import { insist } from '../src/errors';
import { validatePublishRequest, validateRevokeRequest, type PublishRequest, type RevokeRequest } from '../src/operations';
import { Submission, validatePending, type Pending } from './submission';

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
    const parts = nameParts(name);
    for (const artifact of Object.values(DEPLOYMENTS)) insist(implementationMatches(
      await this.publicClient.getCode({ address: artifact.address as Address }), artifact), 'unsupported_protocol');
    const registry = await this.publicClient.readContract({ address: ROOT_REGISTRY, abi: registryAbi, functionName: 'getSubregistry', args: ['eth'] });
    insist(address(registry) === address(ETH_REGISTRY), 'registry_mismatch');
    const state = await this.publicClient.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: 'getState', args: [parts.labelId] });
    insist(state.status === 2 && address(state.latestOwner) === address(this.account), 'issuer_does_not_control_name');
    return parts;
  }
  async deploy(name: string) {
    await this.owner(name);
    const init = encodeFunctionData({ abi: resolverAbi, functionName: 'initialize',
      args: [[{ account: this.account!, roleBitmap: OWNER_ROLES }], [setTextData(name, '')]] });
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
    return this.send({ kind: 'bind', name, to: ETH_REGISTRY,
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
    insist(transaction.to && address(transaction.to) === address(pending.to) && transaction.input === pending.data
      && (!pending.account || address(transaction.from) === address(pending.account)), 'transaction_mismatch');
    if (receipt.status !== 'success') { this.submission.complete(); throw new Error('transaction_reverted'); }
    let resolver: Address | undefined;
    if (pending.kind === 'publish' || pending.kind === 'revoke') {
      const events = parseEventLogs({ abi: resolverAbi, eventName: 'TextUpdated', logs: receipt.logs });
      insist(events.some(event => address(event.address) === address(pending.to) && event.args.recordId.toString() === pending.recordId
        && event.args.key === TEXT_KEY && event.args.value === pending.value), 'publication_mismatch');
      const parts = nameParts(pending.name);
      const read = await this.publicClient.readContract({ address: pending.to, abi: resolverAbi, functionName: 'resolve',
        args: [parts.dns, encodeFunctionData({ abi: textAbi, functionName: 'text', args: [parts.node, TEXT_KEY] })], blockNumber: receipt.blockNumber });
      insist(decodeAbiParameters([{ type: 'string' }], read)[0] === pending.value, 'publication_mismatch');
    } else if (pending.kind === 'deploy') {
      const events = parseEventLogs({ abi: factoryAbi, eventName: 'ProxyDeployed', logs: receipt.logs });
      const created = events.find(event => address(event.address) === address(FACTORY) && address(event.args.implementation) === address(RESOLVER_IMPL)
        && address(event.args.sender) === address(pending.account));
      insist(created, 'deployment_mismatch');
      resolver = created.args.proxyAddress;
    } else if (pending.kind === 'bind') {
      const actual = await this.publicClient.readContract({ address: ETH_REGISTRY, abi: registryAbi, functionName: 'getResolver',
        args: [nameParts(pending.name).label], blockNumber: receipt.blockNumber });
      insist(address(actual) === address(pending.value), 'publication_mismatch');
    } else {
      const granted = await this.publicClient.readContract({ address: pending.to, abi: resolverAbi, functionName: 'hasRoles',
        args: [BigInt(keccak256(toHex(TEXT_KEY))), ROLE_TEXT, pending.helper!], blockNumber: receipt.blockNumber });
      insist(granted === (pending.kind === 'grant'), 'permission_mismatch');
    }
    this.submission.complete();
    return { receipt, resolver, pending, publication: { chainId: CHAIN_ID, transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber.toString(), blockHash: receipt.blockHash } };
  }
}
