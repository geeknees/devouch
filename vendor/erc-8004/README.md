# Pinned ERC-8004 fixtures

`IdentityRegistryUpgradeable`, `ReputationRegistryUpgradeable`, and `MinimalUUPS` are unmodified MIT-licensed sources from [erc-8004/erc-8004-contracts at b9e466c250744a7e06b13dff9d3c2844ed64f825](https://github.com/erc-8004/erc-8004-contracts/tree/b9e466c250744a7e06b13dff9d3c2844ed64f825/contracts). The Solidity files retain their upstream SPDX notices. OpenZeppelin dependencies and `ERC1967Proxy` are version 5.4.0; their MIT license is included here. No Devouch contract is defined.

The JSON artifacts contain ABI, creation bytecode, runtime templates, and immutable offsets. `compiler-input.json` includes the exact Solidity standard JSON input, including dependency sources and their notices. `manifest.json` pins source revisions, compiler/dependency versions, and file SHA-256 hashes.

To rebuild, use a disposable directory with Node.js and install **Hardhat 3.0.6**, **@openzeppelin/contracts 5.4.0**, and **@openzeppelin/contracts-upgradeable 5.4.0**. These are fixture-build dependencies, not additions to Devouch's runtime dependencies. Set `type: module` in its package.json and copy `contracts/*.sol` from this directory to its `contracts/` directory. Configure Hardhat:

```js
export default {
  solidity: {
    version: '0.8.24',
    npmFilesToBuild: ['@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol'],
    settings: { evmVersion: 'shanghai', viaIR: true, optimizer: { enabled: true, runs: 200 } }
  }
};
```

Run `npx hardhat compile --force`, then from the Devouch root:

```sh
ruby scripts/import-erc8004-artifacts.rb /path/to/disposable/build
```

The importer checks upstream Git blob hashes, exact compiled source content, compiler settings, and OpenZeppelin version before writing artifacts. The complete saved compiler input can also be passed to Solidity 0.8.24's standard JSON interface for bytecode comparison. The fixture's proxy owner impersonation is restricted to a disposable loopback EVM; it is not a public deployment procedure.
