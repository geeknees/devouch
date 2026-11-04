// ABOUTME: Checks vendored ERC-8004 fixture integrity and the reader ABI against upstream artifacts.
// ABOUTME: Makes source pins and indexed event layouts part of routine verification.
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { identityAbi, reputationAbi } from '../../src/erc8004';
import identity from '../../vendor/erc-8004/IdentityRegistryUpgradeable.json';
import reputation from '../../vendor/erc-8004/ReputationRegistryUpgradeable.json';
import manifest from '../../vendor/erc-8004/manifest.json';

test('fixture files match their source and artifact manifest', () => {
  for (const [path, hash] of Object.entries(manifest.files)) {
    expect(createHash('sha256').update(readFileSync('vendor/erc-8004/' + path)).digest('hex')).toBe(hash);
  }
});

test('reader functions and indexed event arguments match the pinned official registries', () => {
  for (const [abi, original] of [[identityAbi, identity.abi], [reputationAbi, reputation.abi]] as const) {
    for (const entry of abi) {
      const candidates = original.filter(e => e.type === entry.type && 'name' in e && e.name === entry.name);
      const signature = entry.inputs.map(i => ({ type: i.type, indexed: 'indexed' in i && i.indexed === true }));
      expect(candidates.some(e => JSON.stringify(e.inputs?.map(i => ({ type: i.type,
        indexed: 'indexed' in i && i.indexed === true }))) === JSON.stringify(signature))).toBe(true);
    }
  }
});
