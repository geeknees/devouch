// ABOUTME: Applies the same ERC-8004 acceptance fixtures as the Ruby CLI policy suite.
// ABOUTME: Preserves rejection ordering and malformed-policy boundaries across both interfaces.
import { expect, test } from 'bun:test';
import fixtures from '../fixtures/policy-cases.json';
import { evaluateErc8004Policy, parseErc8004Policy, type PolicyDecision } from '../../src/erc8004-policy';
import type { FeedbackEvidence } from '../../src/erc8004';
for (const fixture of fixtures) test('shared policy: ' + fixture.name, () => {
  const raw = fixture.policy_raw ?? JSON.stringify(fixture.policy);
  if ('error' in fixture.expected) expect(() => parseErc8004Policy(raw)).toThrow(fixture.expected.error);
  else expect(evaluateErc8004Policy(parseErc8004Policy(raw), fixture.evidence as FeedbackEvidence)).toEqual(fixture.expected as PolicyDecision);
});
