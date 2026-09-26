// ABOUTME: Checks the controller-published agent identity format and permission boundaries.
// ABOUTME: Rejects mismatched routing, controllers, chains, and unsupported grants.
import { expect, test } from 'bun:test';
import { makeAgentIdentity, parseAgentIdentity, profileKey } from '../../src/agent-namespace';

const controller = '0x1111111111111111111111111111111111111111';
const wallet = '0x2222222222222222222222222222222222222222';
const name = 'agent.agents.demo.eth';
test('agent identity carries the exact name, GitHub account, controller and wallet', () => {
  const identity = makeAgentIdentity(name, controller, 'github:287365775', wallet);
  expect(parseAgentIdentity(JSON.stringify(identity), name, controller)).toEqual(identity);
  for (const changed of [{ name: 'sibling.agents.demo.eth' }, { controller: wallet }, { chainId: 1 },
    { version: 2 }, { subject: 'github:username' }, { human: true }]) {
    expect(() => parseAgentIdentity(JSON.stringify({ ...identity, ...changed }), name, controller)).toThrow();
  }
  expect(() => parseAgentIdentity('', name, controller)).toThrow('agent_identity_missing');
});
test('agent grants are confined to profile fields', () => {
  for (const key of ['url', 'avatar', 'description'] as const) expect(profileKey(key)).toBe(key);
  for (const key of ['devouch.vouch', 'devouch.agent', '', 'addr', '*']) {
    expect(() => profileKey(key)).toThrow('unsupported_agent_permission');
  }
});
