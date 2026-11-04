// ABOUTME: Tests strict ERC-8004 references and repository-local acceptance of evidence.
// ABOUTME: Keeps ENS resolver policy separate and rejects incomplete evidence before policy evaluation.
import { expect, test } from 'bun:test';
import { Erc8004Reader, parseFeedbackReference, parseFeedbackData } from '../../src/erc8004';
import { evaluateErc8004Policy, parseErc8004Policy } from '../../src/erc8004-policy';

const address = '0x1111111111111111111111111111111111111111';
const hash = '0x' + '12'.repeat(32);
const registry = { identityRegistry: address, reputationRegistry: address,
  identityImplementation: address, reputationImplementation: address,
  identityCodeHash: hash, reputationCodeHash: hash, identityProxyCodeHash: hash, reputationProxyCodeHash: hash };
const policy = { format: 'devouch-erc8004-policy-v1', repositoryId: 'example/a', chainId: 11155111,
  trustedIssuers: [address], allowedScopes: ['oss-contribution'], allowedRegistries: [registry], requiredIssuers: 1 };

test('default current verification refuses stale finalized snapshots before reading evidence', async () => {
  const reference = parseFeedbackReference(JSON.stringify({ format: 'devouch-erc8004-v1', chainId: 11155111,
    identityRegistry: address, reputationRegistry: address, agentId: '0', clientAddress: address,
    feedbackIndex: '1', feedbackBlock: '12' }));
  const reader = new Erc8004Reader({ getChainId: async () => 11155111,
    getBlock: async () => ({ number: 12n, hash, timestamp: BigInt(Math.floor(Date.now() / 1000)) - 7200n }) } as never);
  expect(await reader.inspect(reference, 'github:123')).toEqual({ evidence_status: 'unavailable', reason_codes: ['snapshot_stale'] });
});

test('the same evidence is accepted or rejected by each repository without a global score', () => {
  const a = parseErc8004Policy(JSON.stringify(policy));
  const b = parseErc8004Policy(JSON.stringify({ ...policy, repositoryId: 'example/b', trustedIssuers: [] }));
  const evidence = { evidence_status: 'valid' as const, reason_codes: [], chainId: 11155111,
    issuer: address, scope: 'oss-contribution', registry };
  expect(evaluateErc8004Policy(a, evidence)).toEqual({ policy_status: 'accepted', reason_codes: [] });
  expect(evaluateErc8004Policy(b, evidence)).toEqual({ policy_status: 'rejected', reason_codes: ['issuer_not_trusted'] });
  expect(evaluateErc8004Policy(a, { ...evidence, chainId: 1 }).reason_codes).toEqual(['chain_not_allowed']);
  expect(evaluateErc8004Policy(a, { ...evidence, registry: { ...registry, reputationCodeHash: '0x' + '34'.repeat(32) } }).reason_codes)
    .toEqual(['registry_not_allowed']);
  for (const evidence_status of ['missing', 'expired', 'revoked', 'invalid', 'unavailable'] as const) {
    expect(evaluateErc8004Policy(a, { ...evidence, evidence_status, reason_codes: ['test_failure'] }))
      .toEqual({ policy_status: 'not_evaluated', reason_codes: ['test_failure'] });
  }
});

test('ERC policy rejects ENS fields, duplicate keys, unknown claims, and missing deployment pins', () => {
  for (const candidate of [{ ...policy, allowedResolvers: [] }, { ...policy, format: '1' },
    { ...policy, chainId: '11155111' }, { ...policy, requiredIssuers: 2 }, { ...policy, repositoryId: 'example/a\n' },
    { ...policy, trustedIssuers: [address + '\n'] }, { ...policy, allowedScopes: ['oss-contribution\n'] },
    { ...policy, allowedRegistries: [{ ...registry, identityCodeHash: undefined }] }]) {
    expect(() => parseErc8004Policy(JSON.stringify(candidate))).toThrow('invalid_policy');
  }
  expect(() => parseErc8004Policy(JSON.stringify(policy).replace('"chainId":11155111', '"chainId":1,"chainId":11155111')))
    .toThrow('invalid_policy');
});

test('feedback references use canonical uint strings and never interpret an agent ID as a GitHub ID', () => {
  const reference = { format: 'devouch-erc8004-v1', chainId: 11155111, identityRegistry: address,
    reputationRegistry: address, agentId: '0', clientAddress: address, feedbackIndex: '1', feedbackBlock: '12' };
  expect(parseFeedbackReference(JSON.stringify(reference)).agentId).toBe('0');
  for (const change of [{ agentId: 0 }, { agentId: '01' }, { agentId: '0\n' }, { feedbackIndex: '0' }, { feedbackIndex: (2n ** 64n).toString() },
    { feedbackBlock: '-1' }, { clientAddress: '0x' + '0'.repeat(40) }, { extra: true }]) {
    expect(() => parseFeedbackReference(JSON.stringify({ ...reference, ...change }))).toThrow();
  }
});

test('application data requires a declared owner, exact GitHub subject, scope, and finite lifetime', () => {
  const data = { format: 'devouch-feedback-v1', subject: 'github:123', owner: address,
    scope: 'oss-contribution', issuedAt: '1000', expiresAt: '4600' };
  expect(parseFeedbackData(JSON.stringify(data)).subject).toBe('github:123');
  for (const change of [{ subject: 'github:0123' }, { subject: 'github:123\n' }, { subject: 'geeknees' }, { expiresAt: '1000' },
    { issuedAt: 1000 }, { expiresAt: '99999999999999999999' }, { accountOwnershipVerified: true }]) {
    expect(() => parseFeedbackData(JSON.stringify({ ...data, ...change }))).toThrow();
  }
});
