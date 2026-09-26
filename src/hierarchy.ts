// ABOUTME: Describes the exact registry path and authority changes on which an endorsement depends.
// ABOUTME: Ignores unrelated sibling state while rejecting restoration of a changed trust path.
import { keccak256, toHex, type Address, type Hex } from 'viem';
import type { Message } from './credential';
import { REGISTRY_AUTHORITY_ROLES, ROLE_LINK, ROLE_TEXT, ROLE_UPGRADE, sameLabel } from './ens';
import { order, type Position } from './history';

export type RegistryState = { status: number; expiry: bigint; latestOwner: Address; tokenId: bigint; resource: bigint };
export type NameHop = { name: string; registry: Address; label: string; labelId: bigint; state: RegistryState; subregistry: Address };
export type ChainEvent = Position & { name: string; args: Record<string, unknown>; address: Address; blockHash: Hex; transactionHash: Hex };

export function authorityChanged(events: ChainEvent[], publication: Position, message: Message, path: NameHop[]) {
  const hierarchical = path.length > 2;
  const key = BigInt(keccak256(toHex('devouch.vouch')));
  const resolverAuthority = ROLE_TEXT | ROLE_LINK | ROLE_UPGRADE;
  return events.some(event => {
    if (order(event, publication) <= 0) return false;
    if (event.address.toLowerCase() === message.resolver.toLowerCase()) {
      if (event.name !== 'EACRolesChanged') return false;
      const changed = (event.args.oldRoleBitmap as bigint) ^ (event.args.newRoleBitmap as bigint);
      return (event.args.resource === 0n && (changed & (resolverAuthority | (resolverAuthority << 128n))) !== 0n)
        || (hierarchical && event.args.resource === key && (changed & (ROLE_TEXT | (ROLE_TEXT << 128n))) !== 0n);
    }
    return path.some((hop, index) => {
      if (event.address.toLowerCase() !== hop.registry.toLowerCase()) return false;
      if (event.name === 'ParentUpdated') return index > 1;
      if (event.name === 'EACRolesChanged') {
        const resource = event.args.resource as bigint;
        const changed = (event.args.oldRoleBitmap as bigint) ^ (event.args.newRoleBitmap as bigint);
        return (resource === 0n || sameLabel(resource, hop.labelId)) && (changed & REGISTRY_AUTHORITY_ROLES) !== 0n;
      }
      if (event.name === 'TransferSingle') return sameLabel(event.args.id as bigint, hop.labelId) && event.args.from !== event.args.to;
      if (event.name === 'TransferBatch') return (event.args.ids as bigint[]).some(id => sameLabel(id, hop.labelId)) && event.args.from !== event.args.to;
      if (event.name === 'TokenRegenerated') return sameLabel(event.args.oldTokenId as bigint, hop.labelId);
      if (['LabelRegistered', 'LabelReserved', 'LabelUnregistered'].includes(event.name)) return sameLabel(event.args.tokenId as bigint, hop.labelId);
      if (event.name === 'SubregistryUpdated') return index < path.length - 1 && sameLabel(event.args.tokenId as bigint, hop.labelId);
      if (event.name === 'ResolverUpdated') return index === path.length - 1 && sameLabel(event.args.tokenId as bigint, hop.labelId);
      return false;
    });
  });
}

export function summarizePath(path: NameHop[]) {
  return path.map(hop => ({ name: hop.name, registry: hop.registry, owner: hop.state.latestOwner,
    token_id: hop.state.tokenId.toString(), resource: hop.state.resource.toString(),
    expires_at: hop.state.expiry.toString(), subregistry: hop.subregistry }));
}
