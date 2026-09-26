// ABOUTME: Looks up the issuer's primary ENS name at the endorsement's checked block.
// ABOUTME: Leaves missing names and RPC failures as optional display metadata, never trust decisions.
import type { Address } from 'viem';

type NameClient = { getEnsName(input: { address: Address; blockNumber: bigint }): Promise<string | null> };
export type IssuerIdentity = { name: string | null; status: 'resolved' | 'not_set' | 'unavailable' };

export async function lookupIssuerName(client: NameClient, address: Address, blockNumber: bigint): Promise<IssuerIdentity> {
  try {
    // viem calls the Universal Resolver, which verifies the returned name's forward address.
    const name = await client.getEnsName({ address, blockNumber });
    return name ? { name, status: 'resolved' } : { name: null, status: 'not_set' };
  } catch { return { name: null, status: 'unavailable' }; }
}
