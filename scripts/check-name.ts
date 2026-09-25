// ABOUTME: Reads a demo name's public owner and resolver before wallet setup.
// ABOUTME: Reports readiness without accessing keys, signing, or submitting transactions.
import { zeroAddress } from 'viem';
import { ChainReader } from '../src/chain';
import { DEFAULT_RPC, ETH_REGISTRY, nameParts, registryAbi } from '../src/ens';
import { EvidenceError } from '../src/errors';

async function main() {
const name = process.argv[2];
if (!name) throw new Error('Usage: bun run scripts/check-name.ts name.eth [RPC_URL]');
const reader = new ChainReader(process.argv[3] ?? DEFAULT_RPC);
const snapshot = await reader.snapshot();
const blockNumber = BigInt(snapshot.block_number);
const state = await reader.client.readContract({ address: ETH_REGISTRY, abi: registryAbi,
  functionName: 'getState', args: [nameParts(name).labelId], blockNumber });
const resolver = await reader.client.readContract({ address: ETH_REGISTRY, abi: registryAbi,
  functionName: 'getResolver', args: [nameParts(name).label], blockNumber });
const ownerCode = await reader.client.getCode({ address: state.latestOwner, blockNumber });
console.log(JSON.stringify({ name, snapshot, owner: state.latestOwner, owner_is_eoa: state.latestOwner === zeroAddress ? null : !ownerCode || ownerCode === '0x',
  registration_status: state.status, expiry: state.expiry.toString(), resolver }));
try {
  const location = await reader.prepare(name, state.latestOwner);
  console.log(JSON.stringify({ ready: true, record_id: location.record_id, anchor_start_block: location.anchor_start_block,
    implementation: location.implementation, current_value_bytes: new TextEncoder().encode(location.current_value).length }));
} catch (error) {
  console.log(JSON.stringify({ ready: false, reason: error instanceof EvidenceError ? error.code : 'rpc_unavailable' }));
}
}
main().catch(error => {
  console.log(JSON.stringify({ ready: false, reason: error instanceof EvidenceError ? error.code : 'rpc_unavailable' }));
  process.exitCode = 1;
});
