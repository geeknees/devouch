# Sepolia deployment observation

The built-in [deployment configuration](../config/erc8004-sepolia.json) selects the official ERC-8004 Sepolia registry addresses published in the [upstream deployment table](https://github.com/erc-8004/erc-8004-contracts/blob/b9e466c250744a7e06b13dff9d3c2844ed64f825/README.md). Configuration includes the observed EIP-1967 implementations and full runtime code hashes of implementations and proxies. A later upgrade makes the configured wallet operations fail with `deployment_changed` until the new implementation is explicitly reviewed.

A public, transaction-free read on **2026-11-04** via `https://rpc.sepolia.ethpandaops.io` observed finalized block **12062934**, hash `0x2b2c01afb3fbc556ad751e058c216d49fd72ef34aae4b505fd3ec93e68810595`, timestamp **1793801556**.

| Registry | Proxy | Implementation |
|---|---|---|
| Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x7274e874CA62410a93Bd8bf61c69d8045E399c02` |
| Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | `0x16e0FA7f7C56B9a767E34B192B51f921BE31dA34` |

Both implementation runtimes matched the pinned upstream compiled fixtures after masking compiler-declared immutable slots and removing Solidity metadata. The configuration pins the complete unmodified on-chain runtime hashes; this comparison is an additional observation, not a proof of admin safety or contract correctness. The pinned source/compilation provenance is in [the vendor guide](../vendor/erc-8004/README.md).

Reproduce the public read with:

```sh
bun run scripts/probe-erc8004.ts
```

An optional first argument selects an explicitly chosen public RPC. The probe sends no transactions and reports no private provider diagnostics. It does not rewrite configuration. Review any changed implementation or code hash before updating pins; never automatically trust a probe result supplied by a contributor.

This observation verifies address/code availability and source correspondence at one block. It does **not** establish public-wallet registration, feedback publication, revocation, hosted workspace deployment, or successful real contributor acceptance. Those remain separate release checks. The application default is Sepolia only; mainnet requires an explicitly reviewed deployment and policy rather than an inferred address change.
