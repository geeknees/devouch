// ABOUTME: Exercises namespace creation and agent permissions through the real wallet service.
// ABOUTME: Proves grants are confined to the intended profile, with no authority over endorsements or siblings.
import { expect, test } from 'bun:test';
import { createWalletClient, encodeFunctionData, http, namehash, toHex, type Address, type EIP1193Provider, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { ChainReader } from '../../src/chain';
import { nameParts, registryAbi, resolverAbi, setTextData } from '../../src/ens';
import { Submission, validatePending, type Pending } from '../../web/submission';
import { WalletSession } from '../../web/wallet';
import { issuer, publicClient, rpc, setupEvm, settle, testRpc, wallet } from '../support/evm';
import { issueLeaf } from '../support/hierarchy';

const provider = { async request({ method, params }: { method: string; params?: unknown[] }) {
  if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [issuer.address];
  if (method === 'eth_sendTransaction') {
    const tx = params![0] as { to: Address; data: Hex };
    const hash = await wallet.sendTransaction(tx);
    await publicClient.waitForTransactionReceipt({ hash }); await settle();
    return hash;
  }
  return rpc(method, params);
} } as EIP1193Provider;

async function connectRegistry(session: WalletSession, parent: string) {
  const deployed = await session.deployRegistry(parent);
  expect(deployed.registry).toBeDefined();
  await session.parentRegistry(parent, deployed.registry!);
  await session.bindRegistry(parent, deployed.registry!);
  return deployed.registry!;
}

test('the wallet creates nested publishing names without replacing the direct parent resolver', async () => {
  const fixture = await setupEvm(); await settle();
  const original = await issueLeaf({ ...fixture, node: namehash(fixture.name), subject: 'github:287365775' });
  const pending: unknown[] = [];
  const session = new WalletSession(testRpc, provider, new Submission(value => { if (value) pending.push(value); }));
  await session.connect();
  const registry = await connectRegistry(session, fixture.name);
  const expiry = ((await publicClient.getBlock()).timestamp + 86400n).toString();
  await session.registerName(fixture.name, 'vouches', expiry);
  const namespace = `vouches.${fixture.name}`;
  await connectRegistry(session, namespace);
  await session.registerName(namespace, '287365775', expiry);
  const name = `287365775.${namespace}`;
  const deployed = await session.deploy(name);
  await session.bind(name, deployed.resolver!);
  const reader = new ChainReader(testRpc);
  expect((await reader.prepare(name, issuer.address)).resolver).toBe(deployed.resolver!);
  expect((await reader.prepare(fixture.name, issuer.address)).resolver).toBe(fixture.resolver);
  expect((await reader.inspect(original.parsed)).evidence_status).toBe('valid');
  expect((await reader.inspectName(fixture.name)).path.at(-1)!.subregistry).toBe(registry);
  expect(pending.every(value => validatePending(value))).toBe(true);
  await expect(session.registerName(namespace, '287365775', expiry)).rejects.toThrow('name_already_registered');
  const replacement = await session.deployRegistry(fixture.name);
  await session.parentRegistry(fixture.name, replacement.registry!);
  await expect(session.bindRegistry(fixture.name, replacement.registry!)).rejects.toThrow('subregistry_already_connected');
}, 120000);

test('an agent gets an identity and profile grant that cannot modify its endorsement, parent, or sibling', async () => {
  const fixture = await setupEvm(); await settle();
  const session = new WalletSession(testRpc, provider, new Submission(() => {}));
  await session.connect();
  const registry = await connectRegistry(session, fixture.name);
  const expiry = ((await publicClient.getBlock()).timestamp + 86400n).toString();
  const agent = privateKeyToAccount(generatePrivateKey());
  await rpc('hardhat_setBalance', [agent.address, toHex(10n ** 18n)]);
  const agentWallet = createWalletClient({ account: agent, chain: sepolia, transport: http(testRpc) });
  const names = [`masusanou.${fixture.name}`, `sibling.${fixture.name}`];
  const resolvers: Address[] = [];
  for (const name of names) {
    await session.registerName(fixture.name, name.split('.')[0]!, expiry);
    const deployed = await session.deploy(name, { subject: 'github:287365775', wallet: agent.address });
    resolvers.push(deployed.resolver!);
    await session.bind(name, deployed.resolver!);
  }
  const identity = await new ChainReader(testRpc).readAgent(names[0]!);
  expect(identity.identity.wallet).toBe(agent.address);
  expect(identity.identity.subject).toBe('github:287365775');
  expect(identity.identity.controller).toBe(issuer.address);
  await session.agentPermission(names[0]!, agent.address, 'url', true);
  const canCall = (to: Address, data: Hex) => publicClient.call({ account: agent.address, to, data }).then(() => true, () => false);
  expect(await canCall(resolvers[0]!, setTextData(names[0]!, 'https://example.org/agent', 'url'))).toBe(true);
  expect(await canCall(resolvers[1]!, setTextData(names[1]!, 'https://example.org/agent', 'url'))).toBe(false);
  expect(await canCall(resolvers[0]!, setTextData(names[0]!, '', 'devouch.vouch'))).toBe(false);
  expect(await canCall(resolvers[0]!, setTextData(names[0]!, '{}', 'devouch.agent'))).toBe(false);
  expect(await canCall(registry, encodeFunctionData({ abi: registryAbi, functionName: 'setResolver',
    args: [nameParts(names[0]!).labelId, fixture.resolver] }))).toBe(false);
  expect(await canCall(resolvers[0]!, encodeFunctionData({ abi: resolverAbi, functionName: 'linkToRecord',
    args: [nameParts(names[0]!).node, 0n] }))).toBe(false);
  const hash = await agentWallet.sendTransaction({ to: resolvers[0]!, data: setTextData(names[0]!, 'https://example.org/agent', 'url') });
  await publicClient.waitForTransactionReceipt({ hash }); await settle();
  expect((await new ChainReader(testRpc).readAgent(names[0]!)).permissions.url).toBe(true);
  const agentProvider = { async request({ method, params }: { method: string; params?: unknown[] }) {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [agent.address];
    if (method === 'eth_sendTransaction') {
      const hash = await agentWallet.sendTransaction(params![0] as { to: Address; data: Hex });
      await publicClient.waitForTransactionReceipt({ hash }); await settle(); return hash;
    }
    return rpc(method, params);
  } } as EIP1193Provider;
  const agentSession = new WalletSession(testRpc, agentProvider, new Submission(() => {}));
  await agentSession.connect();
  await agentSession.updateAgentProfile(names[0]!, 'url', 'https://example.org/updated');
  expect((await new ChainReader(testRpc).readAgent(names[0]!)).profile.url).toBe('https://example.org/updated');
  await expect(agentSession.updateAgentProfile(names[0]!, 'description', 'Not granted')).rejects.toThrow('agent_permission_missing');
  await expect(agentSession.registerName(fixture.name, 'unapproved', expiry)).rejects.toThrow('issuer_does_not_control_name');
  await session.agentPermission(names[0]!, agent.address, 'url', false);
  expect(await canCall(resolvers[0]!, setTextData(names[0]!, 'https://example.org/other', 'url'))).toBe(false);
  await expect(agentSession.updateAgentProfile(names[0]!, 'url', 'https://example.org/other')).rejects.toThrow('agent_permission_missing');
  await expect(session.agentPermission(names[0]!, issuer.address, 'url', true)).rejects.toThrow('agent_identity_mismatch');
  await expect(session.agentPermission(names[0]!, agent.address, 'devouch.vouch', true)).rejects.toThrow('unsupported_agent_permission');
  const alias = await wallet.sendTransaction({ to: resolvers[0]!, data: setTextData(`alias.${fixture.name}`, '', 'url') });
  await publicClient.waitForTransactionReceipt({ hash: alias }); await settle();
  await expect(new ChainReader(testRpc).readAgent(names[0]!)).rejects.toThrow('agent_resolver_shared');
}, 120000);

test('a lost namespace deployment response is recovered after reload without a duplicate transaction', async () => {
  const fixture = await setupEvm(); await settle();
  let saved: Pending | null = null, submitted: Hex | undefined, sends = 0;
  const lostProvider = { async request(input: { method: string; params?: unknown[] }) {
    if (input.method === 'eth_sendTransaction') {
      sends++;
      submitted = await provider.request(input as never) as Hex;
      throw new Error('Lost wallet response');
    }
    return provider.request(input as never);
  } } as EIP1193Provider;
  const session = new WalletSession(testRpc, lostProvider, new Submission(value => { saved = value; }));
  await session.connect();
  await expect(session.deployRegistry(fixture.name)).rejects.toThrow('submission_unknown');
  const restored = validatePending(JSON.parse(JSON.stringify(saved)));
  const recovered = new WalletSession(testRpc, provider, new Submission(() => {}, restored));
  await recovered.connect();
  await expect(recovered.deployRegistry(fixture.name)).rejects.toThrow('pending_transaction');
  const result = await recovered.recover(submitted!);
  expect(result.registry).toBeDefined();
  expect(recovered.submission.pending).toBeNull();
  expect(sends).toBe(1);
  await recovered.parentRegistry(fixture.name, result.registry!);
  await recovered.bindRegistry(fixture.name, result.registry!);
  expect((await recovered.reader.inspectName(fixture.name)).path.at(-1)!.subregistry).toBe(result.registry!);
}, 120000);
