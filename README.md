<p align="center">
  <img src="assets/devouch-logo.svg" alt="Devouch logo: a lowercase d whose stem forks in two" width="120" height="120">
</p>

# Devouch

[English](README.md) | [日本語](README.ja.md)

Portable contributor endorsements. An issuer publishes a recommendation; each repository decides whether to accept it.

Devouch provides a **Ruby CLI**, a **[static web workspace](https://geeknees.github.io/devouch/)**, and a **read-only GitHub Action**. The current application uses ENSv2 on Sepolia, with no Devouch API, database, shared publisher key, or custom endorsement contract.

**Valid evidence and repository acceptance are separate.** The same endorsement can be `valid / accepted` in one repository and `valid / rejected` in another. It is input to human review and does not prove humanity, account ownership, authorship, code quality, agency, or permission to merge.

## Start here

| Your goal | Read |
|---|---|
| Try verification, publish, or withdraw an endorsement | [Usage guide](docs/usage.md) |
| Add verification to your repository | [Maintainer guide](docs/adoption-guide.md) |
| Submit contributions from a user or agent account | [Contributor and agent guide](docs/agent-operator-guide.md) |
| Build or contribute to Devouch | [Contributing](CONTRIBUTING.md) |
| Understand the format, boundaries, and architecture | [Documentation index](docs/README.md) |

## Try verification

Open the [workspace](https://geeknees.github.io/devouch/#verify) and enter an ENS name or public PR URL. Verification does not require a wallet. Publishing and withdrawing require the issuer's wallet and Sepolia ETH.

A [public example](https://geeknees.github.io/devouch/?name=masusanou.vouches.geeknees.eth#verify) is available, but its current state and expiry must be checked. The workspace's example repository policies can accept or reject the same evidence without changing any real repository.

To use the CLI, install Ruby 3.4+ and Node.js 24, then clone this repository. Bundled JavaScript is included; CLI use does not require a JavaScript dependency install.

```sh
./exe/devouch --help
./exe/devouch fetch --name CONTRIBUTOR.vouches.ISSUER.eth --output vouch.json \
  --publication-output publication.json --json
./exe/devouch check --repo OWNER/REPOSITORY --credential vouch.json \
  --subject github:12345 --json
```

Replace the name, repository, and numeric GitHub ID with your actual inputs. `check` retrieves the destination repository's policy and verifies the endorsement. It does not submit a PR. See [CLI usage and exit codes](docs/usage.md#cli).

## Adopt in a repository

A maintainer adds `.devouch/policy.json` and a workflow pinned to a reviewed Devouch commit. Each contributor includes their original endorsement as `.devouch/vouches/github-ID.json`.

The Action binds the subject to the actual PR author's numeric ID, reads policy at the base SHA and evidence at the head SHA, and does not execute PR code. Read the result's evidence and policy fields; a green workflow alone does not mean acceptance. Follow the [maintainer guide](docs/adoption-guide.md).

CLI-capable agents can use the portable [devouch-check skill](skills/devouch-check/SKILL.md). Endorsement checks do not grant permission to publish a contribution.

## Design and status

- Repository-local trust, with no global reputation score or token rewards.
- Issuer-controlled publication and withdrawal, with no mandatory Devouch-operated service.
- Explicit expiry, history, and RPC failure handling. Public data remains in chain history after withdrawal.
- Human review and merge decisions remain with maintainers.

Devouch is inspired by [Mitchell Hashimoto's vouch](https://github.com/mitchellh/vouch). It is a separate implementation; vouch also supports sharing contributor lists across repositories. See [design principles and trade-offs](docs/design.md).

This is test-network software. [Verification history](docs/history.md) records dated checks; [the roadmap](docs/roadmap.md) distinguishes open work, including ERC-8004 evaluation and independent adoption. World ID is not integrated; `human_verification` is `not_included`.

## Develop

```sh
bundle install
bun install --frozen-lockfile
bundle exec rake test
bundle exec rake lint
bun test test/ts
bun run typecheck
bun run test:integration
```

Use Bun 1.3.13 and Chrome/Chromium in addition to Ruby and Node.js. The integration suite rebuilds `dist/` and uses disposable local EVMs. See [Contributing](CONTRIBUTING.md) for setup and distribution checks.

MIT licensed. [ENS artifact provenance](vendor/ens-v2/README.md) and bundled notices identify third-party code.
