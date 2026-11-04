// ABOUTME: Preserves the historical state and authorization data needed to reproduce wallet gas failures.
// ABOUTME: Prevents post-upgrade state or omitted EIP-7702 authorizations from producing misleading success.
import { expect, test } from 'bun:test';
import { replayInput } from '../../scripts/replay-wallet-gas';

const tx = { from: '0x' + '11'.repeat(20), to: '0x' + '22'.repeat(20), input: '0x12345678', value: '0x0',
  nonce: '0x3', type: '0x4', chainId: '0xaa36a7', blockNumber: '0x10', gas: '0xc20d6',
  maxFeePerGas: '0x10', maxPriorityFeePerGas: '0x2', gasPrice: '0x8',
  authorizationList: [{ address: '0x' + '33'.repeat(20), chainId: '0xaa36a7', nonce: '0x4', r: '0x1', s: '0x2', yParity: '0x0' }] };

test('replay uses the parent block and preserves the authorization and fee context while changing only gas', () => {
  const input = replayInput(tx, 1_100_000n);
  expect(input.block).toBe('0xf');
  expect(input.call).toEqual({ from: tx.from, to: tx.to, data: tx.input, value: tx.value, gas: '0x10c8e0',
    nonce: tx.nonce, type: tx.type, chainId: tx.chainId, authorizationList: tx.authorizationList,
    maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas });
});

test('legacy transactions retain gasPrice and omit absent type-4 fields', () => {
  const { authorizationList, maxFeePerGas, maxPriorityFeePerGas, ...legacy } = tx;
  const input = replayInput({ ...legacy, type: '0x0' }, 794_838n);
  expect(input.call.gasPrice).toBe(tx.gasPrice);
  expect(input.call).not.toHaveProperty('authorizationList');
  expect(input.call).not.toHaveProperty('maxFeePerGas');
});

test('pending transactions and nonpositive gas do not produce a historical replay', () => {
  expect(() => replayInput({ ...tx, blockNumber: null }, 1n)).toThrow();
  expect(() => replayInput(tx, 0n)).toThrow();
});

test('type-4 replay rejects missing authorization context instead of silently changing the scenario', () => {
  expect(() => replayInput({ ...tx, authorizationList: undefined }, 1_100_000n)).toThrow('invalid type-4 authorization context');
  expect(() => replayInput({ ...tx, authorizationList: [] }, 1_100_000n)).toThrow('invalid type-4 authorization context');
});
