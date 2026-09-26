<p align="center">
  <img src="assets/devouch-logo.svg" alt="Devouch logo: a lowercase d whose stem forks in two" width="120" height="120">
</p>

# Devouch

[English](README.md) | [日本語](README.ja.md)

Portable contributor endorsements, published and withdrawn by their issuer on ENSv2.
One signed recommendation can be evaluated by multiple repositories; each maintainer chooses whom to trust.

Inspired by [Mitchell Hashimoto's vouch](https://github.com/mitchellh/vouch), which asks whether a trusted person
has vouched for a contributor before a maintainer spends time reviewing their work.
vouch already supports sharing contributor lists across repositories. Devouch explores issuer-signed endorsements
with an expiry and a withdrawal history on ENSv2, while keeping each repository's acceptance policy independent.
It is a separate implementation; see the [source comparison](docs/hackathon-research.md#vouch-が扱っている信頼).

Devouch provides a Ruby CLI, a [static web workspace](https://geeknees.github.io/devouch/), and a read-only GitHub Action.
Issuers manage endorsements and agent identities under their own ENS names; repositories apply their own acceptance policies.
It uses Sepolia's official Permissioned Resolver and UserRegistry implementations, with no Devouch API,
database, shared publisher key, or custom endorsement contract.

## Try it

Open the **[wallet-free verification page](https://geeknees.github.io/devouch/?name=masusanou.vouches.geeknees.eth#verify)**
to check an ENSv2 subname endorsement's signature and ENS hierarchy at a fresh Sepolia block.
It shows the issuer's ENS name, subject, scope, expiry, and evidence status.
The same evidence is **accepted** by example repository A and **rejected** by B (`issuer_not_trusted`);
add the issuer to B's **Trusted issuers** field to make it accepted. These examples do not change a real repository's policy.

| In the workspace | What you can do |
|---|---|
| [Verify a PR](https://geeknees.github.io/devouch/?pr=https%3A%2F%2Fgithub.com%2Fgeeknees%2Fdevouch%2Fpull%2F2#verify) | Check a public PR's endorsement against its base policy and explore the result in a trust map. |
| [My endorsements](https://geeknees.github.io/devouch/#manage) | Save up to eight ENS names in your browser, refresh evidence, and inspect agent permissions. Results reset on reload. |
| [Namespaces](https://geeknees.github.io/devouch/#namespaces) | Create subnames and manage agent profile permissions with your wallet. |
| Connection settings | Diagnose your RPC and explicitly choose another provider. |

Publishing and withdrawing require your wallet; verification does not. Dark and light modes are available.
See the [usage guide](docs/usage.md) for the full workflows, local startup, and RPC settings.

## CLI

Use Ruby 3.4 or newer and Node.js 24. Bundled distribution files are included; running the CLI needs no JavaScript dependency installation.
From this checkout, retrieve the demo endorsement into new files and check it against a repository's policy:

```sh
./exe/devouch fetch --name masusanou-dev.eth --output vouch.json \
  --publication-output publication.json --json

./exe/devouch check --repo geeknees/devouch --credential vouch.json \
  --subject github:287365775 --json
```

For your own PR, use its destination repository and actual author's numeric GitHub ID.
`check` verifies the endorsement and repository policy; it does not submit a PR. Continue an authorized submission only on exit **0**.
The same verifier is available through the **GitHub Action** below and the portable **[devouch-check SKILL](skills/devouch-check/SKILL.md)** for CLI-capable agents.
See the [CLI usage guide](docs/usage.md#cli) for all commands, original-file handling, exit codes, and connection settings.

## Adopt in a repository

Add a maintainer-approved `.devouch/policy.json` and a workflow pinned to a published Devouch commit.
Each contributor includes their original endorsement as `.devouch/vouches/github-ID.json`.
The **[Maintainers](https://geeknees.github.io/devouch/#maintainers)** screen helps select trusted issuers and download a policy and workflow.
The Action reads policy at the PR's base SHA and the author's endorsement at its head SHA; it does not execute PR code or approve merges.
Follow the [maintainer guide](docs/adoption-guide.md) or [agent operator guide](docs/agent-operator-guide.md).

## ENSv2 namespaces

- **One subname per endorsement.** Names such as `masusanou.vouches.geeknees.eth` have their own resolver record and withdrawal history. The readable label is separate from the signed GitHub numeric ID.
- **Agents as namespaces.** A name can hold a controller-declared GitHub identity and wallet. ENSv2 Enhanced Access Control lets the controller grant and revoke individual profile fields while retaining endorsement and namespace authority.
- **Verification through the hierarchy.** The verifier follows each parent, registry, ownership, and relevant role change. Restoring changed authority does not reactivate an old endorsement.

Publication, individual withdrawal, and agent profile permission grants, updates, and revocation have been exercised with real wallets on Sepolia.
See the [namespace guide](docs/namespaces.md) and [wallet-test record](docs/sepolia-namespace-check.md).

## Design choices

The reasoning and sources are in the [planning notes](docs/hackathon-planning.md) (Japanese).

- **No global score.** Trust depends on who is asking. Each repository chooses whose endorsements it accepts; the same endorsement can be accepted by one project and rejected by another. A single score would take that judgment away from maintainers.
- **No token rewards.** Paying for endorsements or activity invites volume over judgment and pushes the cost onto maintainers. [What happened to Tea?](https://nesbitt.io/2026/06/11/what-happened-to-tea.html) describes how count-based incentives were abused in package registries. Devouch rewards nothing; an endorsement is worth only what the recommender's reputation is worth to each project.
- **No central server.** Publishing, retrieving, verifying and withdrawing need no Devouch-operated service, key or database. The recommender owns the ENS record, and anyone can check it with the static page, the CLI or the Action against any RPC. Devouch can't forge, block or silently change an endorsement.

## Roadmap

Independent third-party adoption is the next adoption milestone;
the current Action trial is in the project's own repository. World ID remains deferred under the conditions below.

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

For supported names and signatures, history checks, snapshot limits, and public data, see
the [support boundaries](docs/usage.md#support-boundaries) and [verification protocol](docs/protocol.md).

## Develop and verify

In addition to Ruby and Node.js, use Bun 1.3.13, Bundler, and Chrome/Chromium. Use mise if runtimes are not on PATH.

```sh
bundle install
bun install --frozen-lockfile
bundle exec rake test
bundle exec rake lint
bun test test/ts
bun run typecheck
bun run test:integration
```

Integration tests rebuild `dist/` and run against pinned official ENS contracts on a local EVM; they make no public-chain writes.
See [development details](docs/usage.md#development) for browser setup and distribution checks.

## Development history

The [verification record](docs/implementation-status.md) covers implementation and deployment history;
the [AI tool disclosure](docs/submission.md#ai-tool-disclosure) describes how AI tools were used.

MIT licensed. [ENS artifact provenance](vendor/ens-v2/README.md) and distribution notices identify third-party code.
