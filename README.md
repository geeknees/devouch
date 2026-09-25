# Devouch

Portable contributor endorsements, published and withdrawn by their issuer on ENSv2.
One signed recommendation can be evaluated by multiple repositories; each maintainer chooses whom to trust.

Inspired by [Mitchell Hashimoto's vouch](https://github.com/mitchellh/vouch), which asks whether a trusted person
has vouched for a contributor before a maintainer spends time reviewing their work.
vouch already supports sharing contributor lists across repositories. Devouch explores issuer-signed endorsements
with an expiry and a withdrawal history on ENSv2, while keeping each repository's acceptance policy independent.
It is a separate implementation; it does not embed vouch. See the [source comparison](docs/hackathon-research.md#vouch-が扱っている信頼).

This hackathon implementation contains a Ruby CLI, a static wallet workspace, and a read-only GitHub Action.
It uses Sepolia's official Permissioned Resolver. There is no Devouch API, database, shared publisher key, or new registry contract.

**Current evidence:** local browser, CLI, and official-contract integration tests pass.
The issuer published masusanou's endorsement on Sepolia. The CLI accepted the same original under two policies
and rejected it under a policy declining the issuer, using Tenderly and ethPandaOps at the same chain snapshot.
See the [public-chain evidence](docs/demo-evidence.md) and [implementation record](docs/implementation-status.md).
Real-wallet withdrawal, live hosting, a published Action commit, and endorsed fork-PR runs remain to be completed.
The corrected lockfile passes a clean frozen install and the [GitHub test workflow](https://github.com/geeknees/devouch/actions/runs/36160022026).
The private preparation PR's Action reported missing evidence correctly; this is not yet an endorsed fork-PR demonstration.

## Development history

When implementation began, the repository held only the planning documents in `docs/` and a `.gitignore`.
Implementation began at 2026-09-25 22:32 JST in this working tree; no earlier Devouch application code was copied.
The core, CLI, web workspace, and documentation were first committed as grouped commits between 00:30 and 00:37 JST on 2026-09-26, so the early history is coarser than the work itself.
The step-by-step checks made during that period are recorded in the [verification record](docs/implementation-status.md); later work is committed in smaller steps.
AI tool use is disclosed in the [submission draft](docs/submission.md#ai-tool-disclosure).

## Run the workspace

Use Node.js 24 and Ruby 3.4 or newer. Bundled distribution files are included; running the CLI or workspace does not install JavaScript dependencies.

```sh
./exe/devouch --help
node scripts/serve.ts
```

Open **http://127.0.0.1:4173** with an Ethereum wallet extension.
The server binds only to loopback and serves only `dist/web/`.
The same static directory can be hosted on an HTTPS origin; there is no server-side issuance endpoint.
The [release runbook](docs/release-runbook.md) covers the prepared manual GitHub Pages workflow and public Action checks.

1. Acquire a direct `name.eth` on Sepolia using [the ENSv2 app](https://app.ens.dev/).
2. In **ENS setup**, create a dedicated resolver, then connect the name. Both operations require your wallet's confirmation.
3. In **Publish**, enter the contributor's GitHub numeric ID and expiry. Review, sign, and publish in separate steps.
4. Download the original endorsement JSON and publication position. The receiving maintainer can download a policy example.
5. In **Withdraw**, load the endorsement, review it, and clear the exact public record. Run verification again after two more blocks.

The demo account is [masusanou](https://github.com/masusanou), numeric ID `287365775`.
The planned receiving repository is [geeknees/devouch](https://github.com/geeknees/devouch).
It is currently private and will be made public for the demo, as requested by the owner.
Public distribution and fork-PR validation have not yet been performed.
The chosen ENS name is `masusanou-dev.eth`; the published endorsement expires at `2026-10-02T16:45:00Z`.
The [demo examples](examples/demo/README.md) retrieve its original JSON using the recorded public transaction.
The adoption workflow pins the locally tested Action commit;
its public availability remains unverified.

## CLI

`request` and `revoke` create **unsent** files. The workspace handles wallet signatures and transactions.
Replace the uppercase inputs below with your public values. Output filenames must not exist.

```sh
./exe/devouch request --subject github:287365775 --issuer ISSUER_ADDRESS \
  --name ISSUER_NAME.eth --expires-at 2026-09-30T12:00:00Z --output request.json --json

./exe/devouch fetch --name ISSUER_NAME.eth --output vouch.json \
  --publication-output publication.json --json

./exe/devouch verify --credential vouch.json --policy repo-a.json \
  --subject github:287365775 --json

./exe/devouch revoke --credential vouch.json --output revoke-request.json --json
```

Use a future expiry before your ENS name expires. Keep the original JSON bytes unchanged.
Copy the same `vouch.json` into another repository and verify it against that repository's own policy.
The CLI's subject is supplied by its caller; the Action obtains it from GitHub's PR author.

| Exit | Meaning |
|---|---|
| 0 | Valid and accepted, or request/fetch operation completed |
| 1 | Valid evidence rejected by this repository's policy |
| 2 | Invalid, missing, expired, or revoked evidence |
| 3 | Verification unavailable; do not substitute a previous result |
| 4 / 5 / 70 | Usage or configuration / file operation / internal error |

The default RPC is `https://sepolia.gateway.tenderly.co`; the real demo name's history and CLI request were checked with it.
Set `--rpc-url` or `DEVOUCH_RPC_URL` to use another provider.
The alternate `https://rpc.sepolia.ethpandaops.io` also passed the demo name's deployment-history checks.
PublicNode returned unavailable historical state for this name as time passed; it is unsuitable as the demo fallback.
Provider-specific historical limits still apply. No automatic fallback hides provider failures.
The workspace has a separate **Connection settings** field.

## Adopt in a repository

Add a maintainer-approved `.devouch/policy.json` and a workflow pinned to a published Devouch commit.
Each contributor adds `.devouch/vouches/github-ID.json` with their original endorsement.
See the [maintainer guide](docs/adoption-guide.md) and [agent operator guide](docs/agent-operator-guide.md).
The Action reads policy from the event's base SHA and endorsement from its head SHA via GitHub's API.
It does not check out or execute the PR. Report mode does not approve or merge contributions.

## Develop and verify

Build/test tools additionally require Bun 1.3.13, Bundler, and Chromium.
On macOS the browser test uses installed Google Chrome; elsewhere install Playwright's Chromium.
Use mise to supply runtimes if they are not on PATH.

```sh
bundle install
bun install --frozen-lockfile
bundle exec rake test
bundle exec rake lint
bun test test/ts
bun run typecheck
bun run build
bun run test:integration
bun run scripts/probe-rpc.ts
bun run scripts/check-name.ts masusanou-dev.eth
```

On Linux, install the test browser with `bunx playwright install --with-deps chromium`.
Integration tests start a fresh loopback EVM, install pinned official ENS bytecode, and generate disposable accounts in memory.
They make no public-chain writes. Browser tests cover explicit consent, cancellation, unknown delivery, reload/recovery, withdrawal, and mobile overflow.

The release-owned `dist/bridge.mjs` avoids dependency installation in receiving PR jobs.
After source changes, rebuild and include the updated `dist/` files.
Third-party license texts are generated into both distributions.

## Boundaries

This is a reference for contribution review. It does not prove humanity, account ownership, authorship, code quality, agency, or merge approval.
`human_verification` is always `not_included`.
[World sandbox](https://sandbox.auth.world.org/) was inspected; World authentication is not implemented or claimed.

The first release supports one active endorsement per resolver record/key, EOA signatures, and direct normalized Sepolia `name.eth` names.
ENSv1, subname traversal, wildcard resolution, ERC-1271, resolver upgrades, and multiple simultaneous endorsements on one record are unsupported.
Changing a record and restoring its old JSON never reactivates that endorsement.
Create a fresh request with a fresh ID and nonce.

Verification uses a recent snapshot two blocks behind the RPC's head; it is not Ethereum finality.
Historical RPC access, Ethereum/ENS, name maintenance, GitHub, and the chosen wallet remain dependencies.
Revocation does not alter already displayed GitHub checks. Names, numeric account IDs, signatures, relationships, and withdrawn values remain in public history.

Read the [protocol](docs/protocol.md), [demo runbook](docs/demo-runbook.md), and [submission draft](docs/submission.md).
The original planning documents are preserved under `docs/`; the protocol and verification record describe the implemented release.

MIT licensed. [ENS artifact provenance](vendor/ens-v2/README.md) and distribution notices identify third-party code.
