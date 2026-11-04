// ABOUTME: Checks the ERC-only product boundary and explicit deployment selection.
// ABOUTME: Refuses legacy ENS credentials and policies instead of silently converting trust semantics.
import { expect, test } from 'bun:test';
import { parseFeedbackReference } from '../../src/erc8004';
import { parseErc8004Policy } from '../../src/erc8004-policy';
import { parseDeployment, DEFAULT_DEPLOYMENT } from '../../src/erc8004-deployment';
import { validateTransactionPlan } from '../../src/erc8004-operations';

test('the product rejects ENS credentials and resolver policies with a migration reason', () => {
  expect(() => parseFeedbackReference(JSON.stringify({ formatVersion: 1, endorsement: {}, domain: {} })))
    .toThrow('legacy_ens_credential');
  expect(() => parseErc8004Policy(JSON.stringify({ repositoryId: 'example/repo', allowedResolvers: [] })))
    .toThrow('legacy_ens_policy');
});

test('deployment configuration pins both registries and code without inventing a trusted evaluator', () => {
  expect(parseDeployment(JSON.stringify(DEFAULT_DEPLOYMENT))).toEqual(DEFAULT_DEPLOYMENT);
  expect(() => parseDeployment(JSON.stringify({ ...DEFAULT_DEPLOYMENT, registry: {} }))).toThrow('invalid_deployment');
  expect(() => parseDeployment(JSON.stringify({ ...DEFAULT_DEPLOYMENT, chainId: 0 }))).toThrow('invalid_deployment');
});

test('wallet transaction imports reject arbitrary calldata, destinations, values, and extra fields', () => {
  for (const plan of [{ to: DEFAULT_DEPLOYMENT.registry.identityRegistry, data: '0x', value: '1' },
    { operation: 'transfer', data: '0x', from: DEFAULT_DEPLOYMENT.registry.identityRegistry },
    { format: 'devouch-erc8004-plan-v1', operation: 'register', payload: {}, arbitrary: true }]) {
    expect(() => validateTransactionPlan(plan)).toThrow();
  }
});
