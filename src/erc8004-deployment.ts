// ABOUTME: Defines explicitly selected registry deployment pins for wallet operations.
// ABOUTME: Keeps deployment support separate from repository trust in feedback issuers.
import config from '../config/erc8004-sepolia.json';
import { exactKeys, object, strictJson } from './json';
import { EvidenceError, insist } from './errors';
import { Erc8004Reader, sameAddress, validAddress, validHash, type RegistryPin } from './erc8004';
import { registryKeys } from './erc8004-policy';
import type { Address } from 'viem';
export type Deployment = { format: 'devouch-erc8004-deployment-v1'; chainId: number; registry: RegistryPin };
export const DEFAULT_RPC = 'https://rpc.sepolia.ethpandaops.io';
export function parseDeployment(raw: string): Deployment {
  try {
    const d = object(strictJson(raw, 8192)); exactKeys(d, ['format', 'chainId', 'registry']);
    insist(d.format === 'devouch-erc8004-deployment-v1' && Number.isSafeInteger(d.chainId) && Number(d.chainId) > 0);
    const pin = object(d.registry); exactKeys(pin, registryKeys);
    insist(registryKeys.every(key => key.endsWith('Hash') ? validHash(pin[key]) : validAddress(pin[key])));
    return d as Deployment;
  } catch { throw new EvidenceError('invalid_deployment'); }
}
export const DEFAULT_DEPLOYMENT = parseDeployment(JSON.stringify(config));
export async function checkDeployment(reader: Erc8004Reader, deployment: Deployment, blockNumber: bigint) {
  insist(await reader.client.getChainId() === deployment.chainId, 'wrong_chain', 'unavailable');
  const actual = await reader.registryPin(deployment.registry.identityRegistry as Address,
    deployment.registry.reputationRegistry as Address, blockNumber);
  insist(registryKeys.every(key => sameAddress(actual[key], deployment.registry[key])), 'deployment_changed');
  return actual;
}
