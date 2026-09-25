# Demo policies

These reviewable policies use the on-chain owner and resolver of `masusanou-dev.eth`.
They do not contain credentials or imply that a maintainer has merged or approved them.

- `policy-a.json`: the intended `geeknees/devouch` policy.
- `policy-b.json`: a separate local demonstration policy accepting the same issuer.
- `policy-b-reject.json`: that second policy declines every issuer.

The B repository name is an illustrative identifier for CLI comparison, not an existing demo repository.
After the owner publishes the endorsement, retrieve one original JSON and compare:

```sh
./exe/devouch fetch --name masusanou-dev.eth --output .devouch/local/vouch.json --publication-output .devouch/local/publication.json --json
./exe/devouch verify --credential .devouch/local/vouch.json --subject github:287365775 --policy examples/demo/policy-a.json --json
./exe/devouch verify --credential .devouch/local/vouch.json --subject github:287365775 --policy examples/demo/policy-b.json --json
./exe/devouch verify --credential .devouch/local/vouch.json --subject github:287365775 --policy examples/demo/policy-b-reject.json --json
```

Expected while the endorsement is valid: exit 0, 0, 1.
After withdrawal and two additional blocks: exit 2 for all, with revoked evidence.
The files are reused unchanged; do not overwrite previous evidence files when recording another run.
No publication is performed by these commands.

Before adding the adoption workflow, replace `RELEASE_COMMIT_SHA` in the [maintainer guide](../../docs/adoption-guide.md)
with the public release's real commit. Do not install a placeholder workflow.
