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
It uses Sepolia's official Permissioned Resolver and UserRegistry implementations.
There is no Devouch API, database, shared publisher key, or custom endorsement contract.

The `codex/roadmap-20260926` branch adds issuer-owned subnames, agent identities with limited profile permissions,
and a maintainer setup guide in the workspace. The published `v0.1` tag preserves the original demo.
Local implementation and public deployment evidence are tracked separately in the [Roadmap record](docs/roadmap-plan.md).

**Current evidence:** local browser, CLI, and official-contract integration tests pass.
The issuer published masusanou's endorsement on Sepolia. The CLI accepted the same original under two policies
and rejected it under a policy declining the issuer, using Tenderly and ethPandaOps at the same chain snapshot.
See the [public-chain evidence](docs/demo-evidence.md) and [implementation record](docs/implementation-status.md).
The [live workspace](https://geeknees.github.io/devouch/) is published, and the pinned Action is available without authentication.
The [release verification](docs/release-evidence.md) covers the published files and real ENS retrieval from the hosted browser UI.
Masusanou's [fork PR #2](https://github.com/geeknees/devouch/pull/2) reports
`valid / accepted` in the [Devouch Action](https://github.com/geeknees/devouch/actions/runs/36172488074), and its normal CI passes.
Withdrawal and rejection of restored old records are verified on the local EVM running official ENS contracts.
The recorded demo shows publication and withdrawal on that local chain; the public Sepolia endorsement stays active for the judges' QR experience.
Real-wallet withdrawal on Sepolia has not been performed.
The PR demonstration uses masusanou and ends at `valid / accepted`; a separate human-account PR is outside the demo scope.
The [demo runbook](docs/demo-runbook.md) lists the recording and read-only checks to use for rehearsal.
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

For multiple endorsements, use **Namespaces** in this branch's workspace (`http://127.0.0.1:4173/#namespaces`).
Create `vouches.your-name.eth`, use it as the next parent, then register a contributor ID such as
`287365775.vouches.your-name.eth` and connect its own resolver. Repeat for another contributor;
publishing or withdrawing one record leaves its siblings independent. **Include an agent identity** adds
a controller-declared GitHub subject and agent wallet. The controller can grant and revoke only the `url`,
`avatar`, or `description` fields through this UI. The agent can update granted fields with its own wallet.
The [namespace guide](docs/namespaces.md) covers the transactions, recovery, and boundaries.

The demo account is [masusanou](https://github.com/masusanou), numeric ID `287365775`.
The receiving repository is [geeknees/devouch](https://github.com/geeknees/devouch).
The repository and workspace were made public on 2026-09-26 with the owner's approval.
Public distribution and the endorsed agent fork PR are verified in the records linked above.
The chosen ENS name is `masusanou-dev.eth`; the published endorsement expires at `2026-10-02T16:45:00Z`.
The [demo examples](examples/demo/README.md) retrieve its original JSON using the recorded public transaction.
The same wallet also publishes a [self-endorsement for geeknees](https://geeknees.github.io/devouch/?name=geeknees.eth#verify),
GitHub ID `701242`, in a separate record under `geeknees.eth`; its original JSON is [.devouch/vouches/github-701242.json](.devouch/vouches/github-701242.json).
The wallet's current primary ENS name is `geeknees.eth`, so both pages display that issuer name separately from their publication names.
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

./exe/devouch check --repo geeknees/devouch --credential vouch.json \
  --subject github:287365775 --json

./exe/devouch revoke --credential vouch.json --output revoke-request.json --json
```

Use a future expiry before your ENS name expires. Keep the original JSON bytes unchanged.
Copy the same `vouch.json` into another repository and verify it against that repository's own policy.
The CLI's subject is supplied by its caller; the Action obtains it from GitHub's PR author.

Before creating a PR, agents can run `check` with the intended author's numeric GitHub ID.
It reads the public destination's `.devouch/policy.json` at an immutable commit on its default branch
(or `--base BRANCH`), then reuses the full signature, ENS-history, snapshot, and policy verification.
The JSON includes the checked branch, commit, and policy digest. Proceed with an otherwise authorized submission
only on exit **0**; every other code stops this preflight flow. The command makes no file changes or PR submissions
and needs no wallet or GitHub token. Acceptance concerns the endorsement at that snapshot; it does not establish
posting permission, code quality, or human verification. Recheck before submission if the policy or ENS state changes.
See the [agent operator guide](docs/agent-operator-guide.md#prを作る前の送信前チェック).

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
In this branch, **Maintainers** (`http://127.0.0.1:4173/#maintainers`) checks publication names without a wallet.
Explicitly select the issuers, scopes, and resolvers your repository will accept, review the published Action SHA,
and download the policy and workflow. Nothing is written to GitHub by this screen.
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

## Design choices

Three things Devouch deliberately leaves out, and why. The reasoning and sources are in the [planning notes](docs/hackathon-planning.md) (Japanese).

- **No global score.** Trust depends on who is asking. Each repository chooses whose endorsements it accepts; the same endorsement can be accepted by one project and rejected by another. A single score would take that judgment away from maintainers.
- **No token rewards.** Paying for endorsements or activity invites volume over judgment and pushes the cost onto maintainers. [What happened to Tea?](https://nesbitt.io/2026/06/11/what-happened-to-tea.html) describes how count-based incentives were abused in package registries. Devouch rewards nothing; an endorsement is worth only what the recommender's reputation is worth to each project.
- **No central server.** Publishing, retrieving, verifying and withdrawing need no Devouch-operated service, key or database. The recommender owns the ENS record, and anyone can check it with the static page, the CLI or the Action against any RPC. Devouch can't forge, block or silently change an endorsement.

## Roadmap

Implemented on this branch and exercised against the pinned official ENS contracts:

- **One subname per endorsement.** Issuers create names such as `287365775.vouches.masusanou-dev.eth`, each with its own resolver record and independent withdrawal history.
- **Agents as namespaces.** An agent has its own name, controller-declared identity, and individual profile-field grants under ENSv2 Enhanced Access Control. Its permissions can be revoked without handing it endorsement or namespace authority.
- **Verification through the hierarchy.** The verifier follows each parent, registry, ownership, and relevant role change. Restoring changed authority does not reactivate an old endorsement.
- **Maintainer onboarding.** Maintainers select verified recommendations and review explicit trust policy plus a SHA-pinned, read-only Action workflow.

The user selected `geeknees/devouch` for the adoption trial. This is a trial in the project's own repository;
independent third-party adoption has not been demonstrated. See the [completion and trial record](docs/roadmap-plan.md)
for deployment status. World ID remains deferred under the conditions below.

## Boundaries

This is a reference for contribution review. It does not prove humanity, account ownership, authorship, code quality, agency, or merge approval.
`human_verification` is always `not_included`.
[World sandbox](https://sandbox.auth.world.org/) was inspected; World authentication is not implemented or claimed.

**Why World ID is not integrated yet:** this is a trade-off with the **No central server** choice above.
The integration paths checked for this event require an app-controlled secret: the agent sign-in path we inspected
uses a confidential OIDC client, and [IDKit 4.0 requires the relying party to sign proof requests](https://docs.world.org/world-id/idkit/signatures).
A shared integration operated by Devouch would make participants using that integration depend on its key and service.
Self-hosted integrations could distribute that responsibility, but that complete path has not been validated here.
[On-chain proof verification already exists](https://docs.world.org/world-id/idkit/onchain-verification);
verification alone does not remove the request-signing requirement.
Proof of personhood and a contributor recommendation answer different questions and can complement each other.
World ID remains deferred until a complete integration can be verified without a mandatory Devouch-operated service.
See the [prize plan and integration conditions](docs/ethglobal-tokyo-2026-prize-plan.md#world-を追加する場合の条件) (Japanese).

This branch supports one active endorsement per resolver record/key, EOA signatures, direct normalized Sepolia
`name.eth` names and exact subnames through the pinned official UserRegistry, up to ten labels including `eth`.
Separate subnames can hold simultaneous endorsements. ENSv1, wildcard resolution, CCIP Read, ERC-1271,
unknown registry implementations, registry/resolver upgrades, and multiple endorsements in one record are unsupported.
Changing a record and restoring its old JSON never reactivates that endorsement.
Create a fresh request with a fresh ID and nonce.

Verification uses a recent snapshot two blocks behind the RPC's head; it is not Ethereum finality.
Historical RPC access, Ethereum/ENS, name maintenance, GitHub, and the chosen wallet remain dependencies.
Revocation does not alter already displayed GitHub checks. Names, numeric account IDs, signatures, relationships, and withdrawn values remain in public history.

Read the [protocol](docs/protocol.md), [demo runbook](docs/demo-runbook.md), and [submission draft](docs/submission.md).
The original planning documents are preserved under `docs/`; the protocol and verification record describe the implemented release.

MIT licensed. [ENS artifact provenance](vendor/ens-v2/README.md) and distribution notices identify third-party code.
