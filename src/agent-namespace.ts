// ABOUTME: Defines controller-published agent identity and the profile fields agents may edit.
// ABOUTME: Keeps profile grants separate from endorsements, namespace routing, and ownership.
import type { Address } from 'viem';
import { CHAIN_ID, address, exactKeys, normalizedName, object, strictJson, subject } from './credential';
import { insist } from './errors';

export const AGENT_KEY = 'devouch.agent';
export const AGENT_PROFILE_KEYS = ['url', 'avatar', 'description'] as const;
export type AgentProfileKey = typeof AGENT_PROFILE_KEYS[number];
export type AgentIdentity = { version: 1; chainId: typeof CHAIN_ID; name: string; subject: string; wallet: Address; controller: Address };

export function profileKey(input: string): AgentProfileKey {
  insist((AGENT_PROFILE_KEYS as readonly string[]).includes(input), 'unsupported_agent_permission');
  return input as AgentProfileKey;
}
export function makeAgentIdentity(name: string, controller: Address, githubSubject: string, wallet: Address): AgentIdentity {
  return { version: 1, chainId: CHAIN_ID, name: normalizedName(name), subject: subject(githubSubject),
    wallet: address(wallet), controller: address(controller) };
}
export function parseAgentIdentity(raw: string, name: string, controller: Address): AgentIdentity {
  insist(raw.length > 0, 'agent_identity_missing', 'missing');
  const value = object(strictJson(raw, 2048));
  exactKeys(value, ['version', 'chainId', 'name', 'subject', 'wallet', 'controller']);
  insist(value.version === 1 && value.chainId === CHAIN_ID && value.name === name
    && address(value.controller) === address(controller), 'agent_identity_mismatch');
  return makeAgentIdentity(normalizedName(value.name), address(value.controller), subject(value.subject), address(value.wallet));
}
