# Devouch usage guide

[English README](../README.md) | [日本語README](../README.ja.md)

Detailed workspace and CLI instructions, connection settings, and support boundaries.
The [verification record](implementation-status.md) distinguishes local tests, public deployment, and real-wallet checks.

## Run the workspace

Open the [hosted workspace](https://geeknees.github.io/devouch/), or run the same static files locally:

```sh
node scripts/serve.ts
```

Use Node.js 24. Bundled distribution files are included; serving the workspace does not install JavaScript dependencies.
Open **http://127.0.0.1:4173**. Connect an Ethereum wallet extension when publishing or withdrawing;
retrieval, verification, and permission inspection need no wallet.
The server binds only to loopback and serves only `dist/web/`.
The same static directory can be hosted on an HTTPS origin; there is no server-side issuance endpoint.
The [release runbook](release-runbook.md) covers the manual GitHub Pages workflow and public Action checks.

Use the sun/moon button in the header to switch between dark and light mode.
The workspace starts in dark mode and remembers your choice in this browser.

## Verify and compare policies

Open the [wallet-free verification page](https://geeknees.github.io/devouch/?name=masusanou.vouches.geeknees.eth#verify)
to check an ENSv2 subname endorsement's signature and ENS hierarchy at a fresh Sepolia block.
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

## Manage saved endorsements

Open **[My endorsements](https://geeknees.github.io/devouch/#manage)** to save up to eight publication ENS names
in this browser, including direct names and subnames. **Refresh evidence** checks each recommendation's subject,
scope, expiry, and current evidence with the full verifier; **Check agent permissions** independently reads its
controller-declared identity and current profile grants. Successful reads save the publication position so a later
withdrawal can be verified. Results are not saved or treated as current after reloading, and repository policy stays
`not_evaluated` until you choose a repository in Verify. Removing a list entry does not withdraw the endorsement.

After verification, each card shows the full 24-hour days remaining at its checked block, **Less than a day left**,
or **Expired**. A deadline within seven days is marked **Expiring soon**. Refresh to update this display;
it does not replace the evidence or policy result, and disappears when evidence is unchecked or unavailable.

## Publish and withdraw

To explore without a wallet, choose **Try without a wallet**, then **Retrieve from ENS**.
The demo name is prefilled. The workspace displays the signed contributor, issuer, purpose, expiry,
and publication transaction, and downloads the original JSON. Retrieval does not establish current validity;
the verifier evaluates it against a repository's policy.

1. Acquire a direct `name.eth` on Sepolia using [the ENSv2 app](https://app.ens.dev/).
2. In **ENS setup**, create a dedicated resolver, then connect the name. Both operations require your wallet's confirmation.
3. In **Publish**, enter the contributor's GitHub numeric ID and expiry. Review, sign, and publish in separate steps.
4. Download the original endorsement JSON and publication position. The receiving maintainer can download a policy example.
5. In **Withdraw**, load the endorsement, review it, and clear the exact public record. Run verification again after two more blocks.

For multiple endorsements, open **[Namespaces](https://geeknees.github.io/devouch/#namespaces)** (or `http://127.0.0.1:4173/#namespaces` locally).
Create `vouches.your-name.eth`, use it as the next parent, then register a contributor label such as
`masusanou.vouches.your-name.eth` and connect its own resolver. The label and signed GitHub numeric ID are separate inputs.
Repeat for another contributor; publishing or withdrawing one record leaves its siblings independent.
**Include an agent identity** adds a controller-declared GitHub subject and agent wallet.
The controller can grant and revoke only the `url`, `avatar`, or `description` fields through this UI.
The agent can update granted fields with its own wallet.
The [namespace guide](namespaces.md) covers the transactions, recovery, and boundaries.

The [demo examples](../examples/demo/README.md) retrieve the original direct-name endorsement for
[masusanou](https://github.com/masusanou), numeric ID `287365775`, from its recorded publication transaction.
The [current subname and wallet checks](sepolia-namespace-check.md) are recorded separately.

## CLI

Use Ruby 3.4 or newer and Node.js 24. The release-owned `dist/bridge.mjs` is included, so running the CLI
does not require Bun or JavaScript dependency installation. Run `./exe/devouch --help` from this checkout.

`request` and `revoke` create **unsent** files. The workspace handles wallet signatures and transactions.
Replace the uppercase inputs below with your public values. Output filenames must not exist.
`EXPIRY_UTC` must be a future ISO 8601 timestamp before your ENS name expires.

```sh
./exe/devouch request --subject github:287365775 --issuer ISSUER_ADDRESS \
  --name PUBLICATION_NAME.eth --expires-at EXPIRY_UTC --output request.json --json

./exe/devouch fetch --name PUBLICATION_NAME.eth --output vouch.json \
  --publication-output publication.json --json

./exe/devouch verify --credential vouch.json --policy repo-a.json \
  --subject github:287365775 --json

./exe/devouch check --repo OWNER/REPOSITORY --credential vouch.json \
  --subject github:287365775 --json

./exe/devouch revoke --credential vouch.json --output revoke-request.json --json
```

Use the intended contributor's actual GitHub numeric ID. Keep the original JSON bytes unchanged.
Copy the same `vouch.json` into another repository and verify it against that repository's own policy.
The CLI's subject is supplied by its caller; the Action obtains it from GitHub's PR author.
The complete command contract is in the [CLI reference](cli-interface.md).

### Before creating a PR

Run `check` with the intended destination and author's numeric GitHub ID.
It reads the public destination's `.devouch/policy.json` at an immutable commit on its default branch
(or `--base BRANCH`), then reuses the full signature, ENS-history, snapshot, and policy verification.
The JSON includes the checked branch, commit, and policy digest. Proceed with an otherwise authorized submission
only on exit **0**; every other code stops this preflight flow. The command makes no file changes or PR submissions
and needs no wallet or GitHub token. Acceptance concerns the endorsement at that snapshot; it does not establish
posting permission, code quality, or human verification. Recheck before submission if the policy or ENS state changes.
See the [agent operator guide](agent-operator-guide.md#prを作る前の送信前チェック).

CLI-capable agents can use the portable **[devouch-check SKILL](../skills/devouch-check/SKILL.md)**.
Copy the `skills/devouch-check/` folder to the skill location supported by your agent, or load its instructions
directly. It checks the receiving repository and actual PR author's numeric ID, preserves the signed original,
and stops submission for every nonzero exit status. It uses the existing CLI and needs no MCP server.

### Exit codes

| Exit | Meaning |
|---|---|
| 0 | Valid and accepted for `verify`/`check`; file prepared or retrieved for `request`/`fetch`/`revoke` |
| 1 | Valid evidence rejected by this repository's policy |
| 2 | Invalid, missing, expired, or revoked evidence |
| 3 | Verification unavailable; do not substitute a previous result |
| 4 | Usage or configuration error |
| 5 | File operation error |
| 70 | Internal error |

For `request`, `fetch`, and `revoke`, exit 0 does not mean the endorsement has been published, accepted, or withdrawn.
See the [CLI reference](cli-interface.md) for command-specific error cases and JSON fields.

## RPC settings

The default RPC is `https://sepolia.gateway.tenderly.co`.
Set `--rpc-url` or `DEVOUCH_RPC_URL` to use another provider; the command-line option takes precedence.
The alternate is `https://rpc.sepolia.ethpandaops.io`.
Both passed recorded demo history checks; this does not guarantee future availability or history retention.
PublicNode later returned unavailable historical state for the demo name and is unsuitable as its fallback.
Provider-specific historical limits still apply. No automatic fallback hides provider failures.
See the [public-chain checks](demo-evidence.md) and [latest verification record](implementation-status.md).

The workspace has a separate **Connection settings** field.
**Diagnose selected RPC** checks Sepolia, a fresh snapshot, and sample historical state/log reads.
Enter an optional ENS name to run complete endorsement verification after those probes pass.
Failures distinguish rate limits, unavailable history, and connection errors without exposing provider messages.
**Fill public alternative** fills another public URL; only **Use this connection** changes the active provider.
Diagnostics do not imply repository acceptance, and RPC URLs are not saved in browser storage.

## Support boundaries

The verifier supports one active endorsement per resolver record/key, EOA signatures, direct normalized Sepolia
`name.eth` names and exact subnames through the pinned official UserRegistry, up to ten labels including `eth`.
Separate subnames can hold simultaneous endorsements. ENSv1, wildcard resolution, CCIP Read, ERC-1271,
unknown registry implementations, registry/resolver upgrades, and multiple endorsements in one record are unsupported.
Changing a record and restoring its old JSON never reactivates that endorsement.
Create a fresh request with a fresh ID and nonce.

Verification uses a recent snapshot two blocks behind the RPC's head; it is not Ethereum finality.
Historical RPC access, Ethereum/ENS, name maintenance, GitHub, and the chosen wallet remain dependencies.
Revocation does not alter already displayed GitHub checks. Names, numeric account IDs, signatures, relationships,
and withdrawn values remain in public history.
`human_verification` is always `not_included`; see the [README boundaries](../README.md#boundaries).
The [protocol](protocol.md) defines the verification rules, and the [upgrade guide](upgrading-0.2.md) records compatibility.

## Development

Build/test tools additionally require Bun 1.3.13, Bundler, and Chromium.
On macOS the browser test uses installed Google Chrome; on Linux install Playwright's Chromium:

```sh
bunx playwright install --with-deps chromium
```

Use mise to supply runtimes if they are not on PATH. Run the [README checks](../README.md#develop-and-verify)
after installing the browser. Integration tests start a fresh loopback EVM, install pinned official ENS bytecode,
and generate disposable accounts in memory. They make no public-chain writes.
Browser tests cover explicit consent, cancellation, unknown delivery, reload/recovery, withdrawal, and mobile overflow.
They also cover wallet-free retrieval and require a fresh review when prepared or signed endorsement inputs change.

The integration command rebuilds the distribution first. After source changes, include the updated `dist/` files
in your change; third-party license texts are generated into both distributions.
To rebuild separately or check the committed distribution for reproducibility:

```sh
bun run build
git diff --exit-code -- dist/
```

Optional public-RPC probes make read-only requests:

```sh
bun run scripts/probe-rpc.ts
bun run scripts/check-name.ts masusanou.vouches.geeknees.eth
```
