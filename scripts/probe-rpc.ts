// ABOUTME: Checks public Sepolia RPCs and the pinned ENSv2 runtime without a wallet.
// ABOUTME: Prints only public chain evidence and bounded, redacted failure codes.
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { DEFAULT_RPC, SECONDARY_RPC, DEPLOYMENTS, implementationMatches, ROOT_REGISTRY, ETH_REGISTRY, registryAbi } from '../src/ens';

const endpoints = process.argv.slice(2);
for (const endpoint of endpoints.length ? endpoints : [DEFAULT_RPC, SECONDARY_RPC]) {
  const client = createPublicClient({ chain: sepolia, transport: http(endpoint, { timeout: 10000, retryCount: 0 }) });
  try {
    const chainId = await client.getChainId();
    const block = await client.getBlock();
    const matches: Record<string, boolean> = {};
    for (const [name, artifact] of Object.entries(DEPLOYMENTS)) {
      matches[name] = implementationMatches(await client.getCode({ address: artifact.address as `0x${string}`, blockNumber: block.number }), artifact);
    }
    const eth = await client.readContract({ address: ROOT_REGISTRY, abi: registryAbi, functionName: 'getSubregistry', args: ['eth'], blockNumber: block.number });
    const logs = await client.getLogs({ address: ETH_REGISTRY, fromBlock: block.number - 999n, toBlock: block.number });
    console.log(JSON.stringify({ host: new URL(endpoint).hostname, chainId, block: block.number.toString(), hash: block.hash,
      matches, ethRegistryMatches: eth.toLowerCase() === ETH_REGISTRY.toLowerCase(), recentLogs: logs.length }));
  } catch { console.log(JSON.stringify({ host: new URL(endpoint).hostname, error: 'rpc_unavailable' })); }
}
