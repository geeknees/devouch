// ABOUTME: Reads official Sepolia ERC-8004 deployment pins without sending transactions.
// ABOUTME: Reports public registry code observations and keeps provider exception text private.
import { createPublicClient, http, type Address } from 'viem';
import { Erc8004Reader } from '../src/erc8004';
import identityArtifact from '../vendor/erc-8004/IdentityRegistryUpgradeable.json';
import reputationArtifact from '../vendor/erc-8004/ReputationRegistryUpgradeable.json';
const url = process.argv[2] ?? 'https://rpc.sepolia.ethpandaops.io';
const client = createPublicClient({ transport: http(url, { retryCount: 0, timeout: 20000 }) });
try {
  const chainId = await client.getChainId();
  if (chainId !== 11155111) throw new Error('wrong_chain');
  const block = await client.getBlock({ blockTag: 'finalized' });
  const identity: Address = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
  const reputation: Address = '0x8004B663056A597Dffe9eCcC1965A193B7388713';
  const registry = await new Erc8004Reader(client).registryPin(identity, reputation, block.number!);
  const matches = async (address: Address, artifact: typeof identityArtifact | typeof reputationArtifact) => {
    let runtime = (await client.getCode({ address, blockNumber: block.number! }))!.slice(2).toLowerCase();
    let template = artifact.deployedBytecode.slice(2).toLowerCase();
    for (const positions of Object.values(artifact.immutableReferences)) for (const { start, length } of positions) {
      runtime = runtime.slice(0, start * 2) + '0'.repeat(length * 2) + runtime.slice((start + length) * 2);
      template = template.slice(0, start * 2) + '0'.repeat(length * 2) + template.slice((start + length) * 2);
    }
    const strip = (code: string) => code.slice(0, -(parseInt(code.slice(-4), 16) + 2) * 2);
    return strip(runtime) === strip(template);
  };
  const comparison = { identityRuntimeMatchesPinnedSource: await matches(registry.identityImplementation as Address, identityArtifact),
    reputationRuntimeMatchesPinnedSource: await matches(registry.reputationImplementation as Address, reputationArtifact) };
  console.log(JSON.stringify({ format: 'devouch-erc8004-deployment-v1', chainId, registry,
    observation: { blockNumber: block.number!.toString(), blockHash: block.hash, timestamp: block.timestamp.toString() }, comparison }, null, 2));
} catch { console.error('ERC-8004 public deployment observation unavailable'); process.exitCode = 1; }
