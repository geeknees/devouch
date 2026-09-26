// ABOUTME: Pins the official Sepolia ENSv2 contracts and the resolver interfaces used by Devouch.
// ABOUTME: Shares write calldata and bytecode checks between the reader and static wallet UI.
import { encodeFunctionData, keccak256, namehash, parseAbi, toHex, type Address, type Hex } from 'viem';
import { packetToBytes } from 'viem/ens';
import resolverArtifact from '../vendor/ens-v2/PermissionedResolverImpl.json';
import factoryArtifact from '../vendor/ens-v2/VerifiableFactory.json';
import rootArtifact from '../vendor/ens-v2/RootRegistry.json';
import ethArtifact from '../vendor/ens-v2/ETHRegistry.json';
import userRegistryArtifact from '../vendor/ens-v2/UserRegistryImpl.json';
import { TEXT_KEY, normalizedName } from './credential';
import { insist } from './errors';

export const DEFAULT_RPC = 'https://sepolia.gateway.tenderly.co';
export const SECONDARY_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
export const SOURCE_COMMIT = resolverArtifact.sourceCommit;
export const DEPLOYMENTS = { resolver: resolverArtifact, factory: factoryArtifact, root: rootArtifact, eth: ethArtifact, userRegistry: userRegistryArtifact };
export const RESOLVER_IMPL = resolverArtifact.address as Address;
export const USER_REGISTRY_IMPL = userRegistryArtifact.address as Address;
export const FACTORY = factoryArtifact.address as Address;
export const ROOT_REGISTRY = rootArtifact.address as Address;
export const ETH_REGISTRY = ethArtifact.address as Address;
export const DEPLOYMENT_BLOCK = BigInt(factoryArtifact.deploymentBlock);
export const ROLE_ADDRESS = 1n;
export const ROLE_TEXT = 1n << 4n;
export const ROLE_LINK = 1n << 28n;
export const ROLE_UPGRADE = 1n << 124n;
export const OWNER_ROLES = ROLE_TEXT | ROLE_LINK | ROLE_UPGRADE | ((ROLE_TEXT | ROLE_LINK | ROLE_UPGRADE) << 128n);
export const AGENT_OWNER_ROLES = OWNER_ROLES | ROLE_ADDRESS | (ROLE_ADDRESS << 128n);
export const REGISTRY_ROLES = { register: 1n, registerReserved: 1n << 4n, parent: 1n << 8n,
  unregister: 1n << 12n, renew: 1n << 16n, subregistry: 1n << 20n, resolver: 1n << 24n,
  transferAdmin: 1n << 156n, upgrade: ROLE_UPGRADE } as const;
export const REGISTRY_AUTHORITY_ROLES = Object.values(REGISTRY_ROLES).reduce((mask, role) => mask | role | (role << 128n), 0n) & ((1n << 256n) - 1n);
export const REGISTRY_OWNER_ROLES = REGISTRY_AUTHORITY_ROLES;

export const resolverAbi = parseAbi([
  'function resolve(bytes name, bytes data) view returns (bytes)',
  'function getRecordId(bytes32 node) view returns (uint256)',
  'function initialize((address account,uint256 roleBitmap)[] grants,bytes[] calls)',
  'function setText(bytes name,string key,string value)',
  'function setAddress(bytes name,uint256 coinType,bytes addressBytes)',
  'function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)',
  'function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)',
  'function grantSetterRoles(bytes setter,address account) returns (bool)',
  'function revokeRoles(uint256 resource,uint256 roleBitmap,address account) returns (bool)',
  'function linkToRecord(bytes name,uint256 recordId)',
  'function upgradeToAndCall(address implementation,bytes data) payable',
  'event EACRolesChanged(uint256 indexed resource,address indexed account,uint256 oldRoleBitmap,uint256 newRoleBitmap)',
  'event Linked(uint256 indexed recordId,bytes32 indexed node,bytes name)',
  'event TextUpdated(uint256 indexed recordId,string indexed keyHash,string key,string value)',
  'event Upgraded(address indexed implementation)',
]);
export const textAbi = parseAbi(['function text(bytes32 node,string key) view returns (string)']);
export const addressAbi = parseAbi(['function addr(bytes32 node,uint256 coinType) view returns (bytes)']);
export const factoryAbi = parseAbi([
  'function deployProxy(address implementation,uint256 salt,bytes data) returns (address)',
  'function verifyContract(address proxy) view returns (address)',
  'function proxyLogic() view returns (address)',
  'event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)',
]);
export const registryAbi = parseAbi([
  'function getSubregistry(string label) view returns (address)',
  'function getResolver(string label) view returns (address)',
  'function getState(uint256 anyId) view returns ((uint8 status,uint64 expiry,address latestOwner,uint256 tokenId,uint256 resource))',
  'function getParent() view returns (address parent,string label)',
  'function initialize((address account,uint256 roleBitmap)[] grants)',
  'function register(string label,address owner,address subregistry,address resolver,uint256 roleBitmap,uint64 expiry) returns (uint256)',
  'function setParent(address parent,string label)',
  'function setSubregistry(uint256 anyId,address registry)',
  'function setResolver(uint256 anyId,address resolver)',
  'function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)',
  'function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)',
  'function grantRoles(uint256 resource,uint256 roleBitmap,address account) returns (bool)',
  'function revokeRoles(uint256 resource,uint256 roleBitmap,address account) returns (bool)',
  'event EACRolesChanged(uint256 indexed resource,address indexed account,uint256 oldRoleBitmap,uint256 newRoleBitmap)',
  'event ParentUpdated(address indexed parent,string label,address indexed sender)',
  'event TokenRegenerated(uint256 indexed oldTokenId,uint256 indexed newTokenId)',
  'event ResolverUpdated(uint256 indexed tokenId,address indexed resolver,address indexed sender)',
  'event SubregistryUpdated(uint256 indexed tokenId,address indexed subregistry,address indexed sender)',
  'event LabelRegistered(uint256 indexed tokenId,bytes32 indexed labelHash,string label,address owner,uint64 expiry,address indexed sender)',
  'event LabelUnregistered(uint256 indexed tokenId,address indexed sender)',
  'event LabelReserved(uint256 indexed tokenId,bytes32 indexed labelHash,string label,uint64 expiry,address indexed sender)',
  'event ExpiryUpdated(uint256 indexed tokenId,uint64 indexed newExpiry,address indexed sender)',
  'event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)',
  'event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)',
]);
export function nameParts(name: string) {
  normalizedName(name);
  const parts = name.split('.');
  insist(parts.length >= 2 && parts.length <= 10 && parts.at(-1) === 'eth' && !parts.includes('*'), 'unsupported_namespace', 'unavailable');
  return { label: parts[0]!, node: namehash(name), dns: toHex(packetToBytes(name)), labelId: BigInt(keccak256(toHex(parts[0]!))) };
}
export function setTextData(name: string, value: string, key = TEXT_KEY) {
  return encodeFunctionData({ abi: resolverAbi, functionName: 'setText', args: [nameParts(name).dns, key, value] });
}
export function implementationMatches(code: Hex | undefined, artifact: { deployedBytecode: string; immutableReferences: Record<string, { start: number; length: number }[]> }): boolean {
  if (!code || code.length !== artifact.deployedBytecode.length) return false;
  function clear(value: string) {
    for (const offsets of Object.values(artifact.immutableReferences)) for (const { start, length } of offsets) {
      const from = 2 + start * 2;
      value = value.slice(0, from) + '0'.repeat(length * 2) + value.slice(from + length * 2);
    }
    return value.toLowerCase();
  }
  return clear(code) === clear(artifact.deployedBytecode);
}
export function sameLabel(a: bigint, b: bigint) { return a >> 32n === b >> 32n; }
