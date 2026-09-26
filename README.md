<p align="center">
  <img src="assets/devouch-logo.svg" alt="Devouch logo: a lowercase d whose stem forks in two" width="120" height="120">
</p>

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
The [live workspace](https://geeknees.github.io/devouch/) is published, and the pinned Action is available without authentication.
The [release verification](docs/release-evidence.md) covers the published files and real ENS retrieval from the hosted browser UI.
Masusanou's [fork PR #2](https://github.com/geeknees/devouch/pull/2) reports
`valid / accepted` in the [Devouch Action](https://github.com/geeknees/devouch/actions/runs/36172488074), and its normal CI passes.
Real-wallet withdrawal remains to be completed.
The PR demonstration uses masusanou and ends at `valid / accepted`; a separate human-account PR is outside the demo scope.
Withdrawal is demonstrated separately through the wallet and CLI.
The published design passes the [GitHub test workflow](https://github.com/geeknees/devouch/actions/runs/36180353277).
The [design verification](docs/design-verification.md) records the workspace palettes, bundled fonts, and hosted browser checks.

## Development history

When implementation began, the repository held only the planning documents in `docs/` and a `.gitignore`.
Implementation began at 2026-09-25 22:32 JST in this working tree; no earlier Devouch application code was copied.
The core, CLI, web workspace, and documentation were first committed as grouped commits between 00:30 and 00:37 JST on 2026-09-26, so the early history is coarser than the work itself.
The step-by-step checks made during that period are recorded in the [verification record](docs/implementation-status.md); later work is committed in smaller steps.
AI tool use is disclosed in the [submission draft](docs/submission.md#ai-tool-disclosure).

## Run the workspace

Open the [hosted workspace](https://geeknees.github.io/devouch/), or run the same static files locally:

Use Node.js 24 and Ruby 3.4 or newer. Bundled distribution files are included; running the CLI or workspace does not install JavaScript dependencies.

```sh
./exe/devouch --help
node scripts/serve.ts
```

Open **http://127.0.0.1:4173** with an Ethereum wallet extension.
The server binds only to loopback and serves only `dist/web/`.
The same static directory can be hosted on an HTTPS origin; there is no server-side issuance endpoint.
The [release runbook](docs/release-runbook.md) covers the prepared manual GitHub Pages workflow and public Action checks.

Use the sun/moon button in the header to switch between dark and light mode.
The workspace starts in dark mode and remembers your choice in this browser.

Open the [wallet-free verification page](https://geeknees.github.io/devouch/?name=masusanou-dev.eth#verify)
to check the demo endorsement's signature and ENS history at a fresh Sepolia block.
It displays the issuer's reverse-resolved ENS name (or address), subject, scope, expiry, and evidence status.
The same evidence starts as **accepted** by example repository A and **rejected** by B (`issuer_not_trusted`);
add the issuer to B's **Trusted issuers** field to make it accepted. These editable examples do not change any real repository policy.
A saved `publication.json` can retrieve an older endorsement for verification, and **Copy link** includes that position when provided.
No wallet is needed; `human verification: not included` applies throughout.

Choose **Pull request URL** in Verify, or open the [live PR #2 verification](https://geeknees.github.io/devouch/?pr=https%3A%2F%2Fgithub.com%2Fgeeknees%2Fdevouch%2Fpull%2F2#verify).
For a public GitHub PR, it reads `.devouch/policy.json` at the base SHA and the author's endorsement at the head SHA,
matches the signed subject to the PR author's numeric GitHub ID, and runs the same signature and ENS-history verification as the CLI.
It shows the actual repository decision, ENS issuer name, checked commits, policy digest, and Sepolia snapshot.
**Copy link** lets another visitor repeat the live check without a wallet or GitHub login.
This reads public JSON only; it does not execute PR code, update GitHub checks, or approve a merge.

Both verification views include an interactive **Trust map** connecting the signer, ENS publication,
signed GitHub subject, and repository decisions. Select a node to inspect its address, snapshot, or policy reasons;
the ENS name and publication name remain separate. In the example comparison, select **Repository B** and
**Edit trusted issuers** to see its branch change from rejected to accepted. In PR mode, the repository node links
to the policy at the checked base commit. The map uses the existing verification result and makes no extra requests;
it describes the one endorsement and the independent policies in the current check.

To explore without a wallet, choose **Try without a wallet**, then **Retrieve from ENS**.
The demo name is prefilled. The workspace displays the signed contributor, issuer, purpose, expiry,
and publication transaction, and downloads the original JSON. Retrieval does not establish current validity;
the CLI or Action evaluates it against a repository's policy.

1. Acquire a direct `name.eth` on Sepolia using [the ENSv2 app](https://app.ens.dev/).
2. In **ENS setup**, create a dedicated resolver, then connect the name. Both operations require your wallet's confirmation.
3. In **Publish**, enter the contributor's GitHub numeric ID and expiry. Review, sign, and publish in separate steps.
4. Download the original endorsement JSON and publication position. The receiving maintainer can download a policy example.
5. In **Withdraw**, load the endorsement, review it, and clear the exact public record. Run verification again after two more blocks.

The demo account is [masusanou](https://github.com/masusanou), numeric ID `287365775`.
The receiving repository is [geeknees/devouch](https://github.com/geeknees/devouch).
The repository and workspace were made public on 2026-09-26 with the owner's approval.
Public distribution and the endorsed agent fork PR are verified in the records linked above.
The chosen ENS name is `masusanou-dev.eth`; the published endorsement expires at `2026-10-02T16:45:00Z`.
The [demo examples](examples/demo/README.md) retrieve its original JSON using the recorded public transaction.
The adoption workflow pins the locally tested Action commit;
its public availability is verified in the [release record](docs/release-evidence.md).

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
They also cover wallet-free retrieval and require a fresh review when a prepared or signed endorsement's inputs change.

The release-owned `dist/bridge.mjs` avoids dependency installation in receiving PR jobs.
After source changes, rebuild and include the updated `dist/` files.
Third-party license texts are generated into both distributions.

## Roadmap

Next, Devouch should use more of the ENSv2 hierarchy:

- **One subname per endorsement.** Today one resolver record holds one endorsement. An issuer could instead give each endorsed account its own subname under their name (for example `287365775.vouches.masusanou-dev.eth`) with its own `devouch.vouch` record. That allows many endorsements at once, each withdrawn on its own, using ENSv2's hierarchical registry and a subname registry the issuer controls.
- **Agents as namespaces.** An AI agent that sends pull requests could get its own subname, with its own identity and only the permissions the issuer grants it through Enhanced Access Control.
- **Verification that follows the hierarchy.** Before this ships, verification must also check changes to the parent name, the subname registry and granted roles, so that a parent change can never silently restore or forge trust.

Beyond ENS: guide maintainers through choosing trusted issuers and configuring the published Action, and trial the workflow with an independent open-source project. The workspace already exports a policy example, and the Action is publicly available pinned by commit SHA. I will add proof of personhood such as World ID only if it can be verified without making a central service mandatory.

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
