// ABOUTME: Checks Web policy decisions against the same fixtures exercised through the Ruby CLI.
// ABOUTME: Covers trust, scope, resolver, malformed policy, and evidence gating without network calls.
import { expect, test } from 'bun:test';
import cases from '../fixtures/policy-cases.json';
import { evaluatePolicy, parsePolicy, type PolicyEvidence } from '../../src/policy';

for (const fixture of cases) test('shared policy: ' + fixture.name, () => {
  const raw = fixture.policy_raw ?? JSON.stringify(fixture.policy);
  if (fixture.expected.error) expect(() => parsePolicy(raw)).toThrow('invalid_policy');
  else expect(fixture.expected).toEqual(evaluatePolicy(parsePolicy(raw), fixture.evidence as PolicyEvidence));
});
