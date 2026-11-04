// ABOUTME: Verifies actual ERC-8004 bytecode behavior and Devouch evidence boundaries on a local EVM.
// ABOUTME: Covers trust differences, withdrawal, expiry, identity changes, upgrades, and unavailable evidence.
import { expect, test } from 'bun:test';
import { sha256, stringToHex } from 'viem';
import { Erc8004Reader, feedbackDataURI, identityAbi, reputationAbi, MAPPING_KEY } from '../../src/erc8004';
import { evaluateErc8004Policy } from '../../src/erc8004-policy';
import { setupErc8004 } from '../support/erc8004';

test('fixed upstream registries preserve evidence versus repository acceptance and reject self-feedback', async () => {
  const f = await setupErc8004();
  const evidence = await f.reader.inspect(f.reference, f.subject, await f.observe());
  expect(evidence.evidence_status).toBe('valid');
  expect(evidence.declaration?.account_ownership).toBe('not_verified');
  expect(evaluateErc8004Policy(f.policy, evidence).policy_status).toBe('accepted');
  expect(evaluateErc8004Policy({ ...f.policy, repositoryId: 'example/b', trustedIssuers: [] }, evidence))
    .toEqual({ policy_status: 'rejected', reason_codes: ['issuer_not_trusted'] });
  for (const account of [f.owner, f.operator]) {
    await expect(f.client.simulateContract({ account, address: f.reputationRegistry, abi: reputationAbi,
      functionName: 'giveFeedback', args: f.feedbackArgs as never })).rejects.toThrow('Self-feedback not allowed');
  }
  await f.write(f.owner, f.identityRegistry, identityAbi, 'setApprovalForAll', [f.successor, true]);
  await expect(f.client.simulateContract({ account: f.successor, address: f.reputationRegistry, abi: reputationAbi,
    functionName: 'giveFeedback', args: f.feedbackArgs as never })).rejects.toThrow('Self-feedback not allowed');
}, 30000);

test('revocation, expiry, subject mismatch, missing feedback, and RPC failure remain distinct', async () => {
  const f = await setupErc8004();
  const inspect = async (r = f.reference, subject = f.subject) => f.reader.inspect(r, subject, await f.observe());
  expect((await inspect(f.reference, 'github:67890')).reason_codes).toEqual(['subject_mismatch']);
  expect((await inspect({ ...f.reference, feedbackIndex: '99' })).evidence_status).toBe('missing');
  const offline = new Erc8004Reader({ getChainId: async () => { throw new Error('private provider URL'); } } as never);
  expect(await offline.inspect(f.reference, f.subject)).toEqual({ evidence_status: 'unavailable', reason_codes: ['evidence_unavailable'] });
  const anchor = await f.rpc('evm_snapshot');
  await f.write(f.evaluator, f.reputationRegistry, reputationAbi, 'revokeFeedback', [f.agentId, 1n]);
  const revoked = await inspect();
  expect(revoked.evidence_status).toBe('revoked');
  expect(evaluateErc8004Policy(f.policy, revoked).policy_status).toBe('not_evaluated');
  await f.rpc('evm_revert', [anchor]);
  await f.rpc('evm_setNextBlockTimestamp', [Number(f.data.expiresAt)]);
  await f.rpc('evm_mine');
  expect((await inspect()).evidence_status).toBe('expired');
}, 30000);

test('transfers, operator changes, and mapping replacement cannot revive old feedback after restoration', async () => {
  const f = await setupErc8004();
  const scenarios = [
    async () => { await f.write(f.owner, f.identityRegistry, identityAbi, 'transferFrom', [f.owner, f.successor, f.agentId]);
      await f.write(f.successor, f.identityRegistry, identityAbi, 'transferFrom', [f.successor, f.owner, f.agentId]); },
    async () => { await f.write(f.owner, f.identityRegistry, identityAbi, 'approve', [f.successor, f.agentId]);
      await f.write(f.owner, f.identityRegistry, identityAbi, 'approve', [f.operator, f.agentId]); },
    async () => { await f.write(f.owner, f.identityRegistry, identityAbi, 'setMetadata', [f.agentId, MAPPING_KEY, stringToHex('github:999')]);
      await f.write(f.owner, f.identityRegistry, identityAbi, 'setMetadata', [f.agentId, MAPPING_KEY, stringToHex(f.subject)]); },
  ];
  for (const [i, change] of scenarios.entries()) {
    const anchor = await f.rpc('evm_snapshot');
    await change();
    const result = await f.reader.inspect(f.reference, f.subject, await f.observe());
    expect(result.evidence_status).toBe('invalid');
    expect(result.reason_codes).toEqual([i === 2 ? 'github_mapping_changed' : 'agent_authority_changed']);
    await f.rpc('evm_revert', [anchor]);
  }
}, 30000);

test('hash integrity, feedback semantics, historical reads, and registry upgrades fail closed', async () => {
  const f = await setupErc8004();
  const raw = JSON.stringify(f.data);
  await f.write(f.evaluator, f.reputationRegistry, reputationAbi, 'giveFeedback',
    [f.agentId, 1n, 0, f.data.scope, f.data.format, '', feedbackDataURI(raw), sha256(stringToHex(raw + ' '))]);
  const block = await f.observe();
  expect((await f.reader.inspect({ ...f.reference, feedbackIndex: '2', feedbackBlock: block.toString() }, f.subject, block)).reason_codes)
    .toEqual(['feedback_hash_mismatch']);
  await f.write(f.evaluator, f.reputationRegistry, reputationAbi, 'giveFeedback',
    [f.agentId, -1n, 0, f.data.scope, f.data.format, '', feedbackDataURI(raw), sha256(stringToHex(raw))]);
  const negative = await f.observe();
  expect((await f.reader.inspect({ ...f.reference, feedbackIndex: '3', feedbackBlock: negative.toString() }, f.subject, negative)).reason_codes)
    .toEqual(['unsupported_feedback_semantics']);
  const unavailable = new Erc8004Reader({ ...f.client, getLogs: async () => { throw new Error('archive unavailable'); } });
  expect((await unavailable.inspect(f.reference, f.subject, block)).evidence_status).toBe('unavailable');
  // Upgrade and restore the same implementation: endpoint equality alone must not revive evidence.
  const original = f.policy.allowedRegistries[0]!.identityImplementation;
  await f.write(f.bootstrapOwner, f.identityRegistry, f.upgradeAbi, 'upgradeToAndCall', [f.bootstrap, '0x']);
  await f.write(f.bootstrapOwner, f.identityRegistry, f.upgradeAbi, 'upgradeToAndCall', [original, '0x']);
  expect((await f.reader.inspect(f.reference, f.subject, await f.observe())).reason_codes).toEqual(['registry_changed']);
}, 30000);
