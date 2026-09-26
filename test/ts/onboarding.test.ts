// ABOUTME: Tests maintainer-selected trust configuration and immutable Action workflow generation.
// ABOUTME: Refuses unverified records, empty trust, unsafe repository names, and mutable Action references.
import { expect, test } from 'bun:test';
import { buildOnboarding } from '../../src/onboarding';
import { evaluatePolicy } from '../../src/policy';
const issuer = '0x1111111111111111111111111111111111111111';
const resolver = '0x2222222222222222222222222222222222222222';
const implementation = '0x14f09fd05d4585759e54844dc9b00147131cf243';
const evidence = { evidence_status: 'valid' as const, reason_codes: [], issuer, resolver, implementation, scope: 'oss-contribution' };
const sha = '4fc4407a3778aad9d0b71db2e1f3e8e58051570a';
test('selected endorsements generate explicit deduplicated trust and a read-only pinned workflow', () => {
  const result = buildOnboarding('maintainer/project', sha, [evidence, evidence,
    { ...evidence, resolver: '0x3333333333333333333333333333333333333333' }]);
  expect(result.policy.trustedIssuers).toEqual([issuer]);
  expect(result.policy.allowedResolvers).toHaveLength(2);
  expect(evaluatePolicy(result.policy, evidence).policy_status).toBe('accepted');
  expect(evaluatePolicy(result.policy, { ...evidence, issuer: resolver }).reason_codes).toContain('issuer_not_trusted');
  expect(result.workflow).toContain('uses: geeknees/devouch@' + sha);
  expect(result.workflow).toContain('mode: report');
  expect(result.workflow).toContain('contents: read');
  expect(result.workflow).toContain('pull-requests: read');
  expect(result.workflow).not.toContain('checkout');
  expect(result.workflow).not.toContain('pull_request_target');
  expect(result.workflow).not.toContain('write');
});
test('export requires a maintainer selection, valid evidence, a repository, and an immutable release', () => {
  expect(() => buildOnboarding('owner/repo', sha, [])).toThrow('trust_selection_required');
  for (const state of ['invalid', 'revoked', 'expired', 'missing', 'unavailable'] as const) {
    expect(() => buildOnboarding('owner/repo', sha, [{ ...evidence, evidence_status: state }])).toThrow('evidence_not_valid');
  }
  for (const ref of ['main', 'v0.1', sha + '\n', '${{ secrets.PAT }}']) {
    expect(() => buildOnboarding('owner/repo', ref, [evidence])).toThrow('invalid_action_sha');
  }
  expect(() => buildOnboarding('owner/repo\npermissions: write-all', sha, [evidence])).toThrow('invalid_policy');
});
