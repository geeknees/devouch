# Demo policies and publication

These reviewable policies use the on-chain owner and resolver of `masusanou-dev.eth`.
They do not contain credentials or imply that a maintainer has merged or approved them.

- `policy-a.json`: the intended `geeknees/devouch` policy.
- `policy-b.json`: a separate local demonstration policy accepting the same issuer.
- `policy-b-reject.json`: that second policy declines every issuer.

The B repository name is an illustrative identifier for CLI comparison, not an existing demo repository.
The owner published masusanou's endorsement on Sepolia. The [verification record](../../docs/demo-evidence.md)
contains the receipt, original digest, and results. Retrieve that same original and compare:

```sh
./exe/devouch fetch --name masusanou-dev.eth --publication examples/demo/publication-masusanou.json --output .devouch/local/vouch.json --publication-output .devouch/local/publication.json --rpc-url https://rpc.sepolia.ethpandaops.io --json
./exe/devouch verify --credential .devouch/local/vouch.json --subject github:287365775 --policy examples/demo/policy-a.json --rpc-url https://sepolia.gateway.tenderly.co --json
./exe/devouch verify --credential .devouch/local/vouch.json --subject github:287365775 --policy examples/demo/policy-b.json --rpc-url https://rpc.sepolia.ethpandaops.io --json
./exe/devouch verify --credential .devouch/local/vouch.json --subject github:287365775 --policy examples/demo/policy-b-reject.json --rpc-url https://rpc.sepolia.ethpandaops.io --json
```

The recorded original is 785 bytes, SHA-256 `744713f4d8d2b1685054969db5358d527cb1c6c6a12bca362160f742ef744256`.
It expires at `2026-10-02T16:45:00Z`. Publication retrieval also works after withdrawal; run verification to learn its current state.
Observed at block `11780543`: exit 0, 0, 1. These are also the expected results while the endorsement remains valid.
After withdrawal and two additional blocks: exit 2 for all, with revoked evidence.
The files are reused unchanged; do not overwrite previous evidence files when recording another run.
No publication is performed by these commands.

The [adoption workflow](../../.github/workflows/devouch.yml) pins the locally tested Action commit.
Follow the [release runbook](../../docs/release-runbook.md) and verify that the repository and pinned commit
are publicly accessible before using it for the fork-PR demonstration.
