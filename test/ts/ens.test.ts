// ABOUTME: Checks the supported resolver ABI against the pinned upstream artifact.
// ABOUTME: Guards the ENSv2 name encoding and immutable-aware runtime comparison.
import { expect, test } from 'bun:test';
import { decodeFunctionData } from 'viem';
import { DEPLOYMENTS, implementationMatches, resolverAbi, setTextData, sameLabel, nameParts } from '../../src/ens';

test('writes use ENSv2 DNS names rather than the ENSv1 node setter', () => {
  const decoded = decodeFunctionData({ abi: DEPLOYMENTS.resolver.abi, data: setTextData('demo.eth', 'hello') });
  expect(decoded.functionName).toBe('setText');
  expect(decoded.args).toEqual(['0x0464656d6f0365746800', 'devouch.vouch', 'hello']);
});
test('all resolver ABI entries match the official input and event signatures', () => {
  for (const entry of resolverAbi) {
    const original = DEPLOYMENTS.resolver.abi.find(e => e.type === entry.type && 'name' in e && e.name === entry.name);
    expect(original).toBeDefined();
    expect(original?.inputs?.map(i => ({ type: i.type, indexed: 'indexed' in i && i.indexed === true })))
      .toEqual(entry.inputs.map(i => ({ type: i.type, indexed: 'indexed' in i && i.indexed === true })));
  }
});
test('runtime equality ignores only the documented immutable offsets', () => {
  const artifact = DEPLOYMENTS.resolver;
  expect(implementationMatches(artifact.deployedBytecode as `0x${string}`, artifact)).toBe(true);
  expect(implementationMatches(`0x00${artifact.deployedBytecode.slice(4)}`, artifact)).toBe(false);
});
test('token regeneration does not change the registry label identity', () => {
  expect(sameLabel(0xabcdef00000001n, 0xabcdef00000002n)).toBe(true);
  expect(sameLabel(0xabcdee00000001n, 0xabcdef00000001n)).toBe(false);
});
test('unimplemented namespace traversal is not silently treated as ENSv2 support', () => {
  expect(() => nameParts('sub.demo.eth')).toThrow('unsupported_namespace');
});
