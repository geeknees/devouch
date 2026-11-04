<p align="center">
  <img src="assets/devouch-logo.svg" alt="Devouch logo" width="120" height="120">
</p>

# Devouch

[English](README.md) | [日本語](README.ja.md)

Portable contributor endorsements. An independent evaluator publishes a recommendation; each repository decides whether to accept it.

Devouch provides a **Ruby CLI**, a **static wallet workspace**, and a **read-only GitHub Action** using ERC-8004 Identity and Reputation registries on Sepolia. There is no Devouch-operated API, database, shared publisher key, or custom endorsement contract.

**Evidence validity and repository acceptance are separate.** The same recommendation can be `valid / accepted` in one repository and `valid / rejected` in another. It supports human review; it does not prove humanity, GitHub account ownership, authorship, code quality, delegation, or permission to merge.

## Start here

| Your goal | Read |
|---|---|
| Register an agent, publish, verify, or withdraw feedback | [Usage](docs/usage.md) |
| Add verification to a repository | [Maintainer adoption](docs/adoption-guide.md) |
| Submit from a user or agent account | [Contributor guide](docs/agent-operator-guide.md) |
| Migrate an ENS installation | [Upgrade and rollback](docs/upgrading-0.3.md) |
| Build or contribute | [Contributing](CONTRIBUTING.md) |
| Understand evidence and trade-offs | [Documentation index](docs/README.md) |

## Try the CLI

Install Ruby 3.4+ and Node.js 24, then clone this repository. The committed JavaScript bundle supports CLI use without installing JavaScript dependencies.

```sh
./exe/devouch --help
./exe/devouch verify --credential feedback.json --policy .devouch/erc8004-policy.json \
  --subject github:12345 --json
./exe/devouch check --repo OWNER/REPOSITORY --credential feedback.json \
  --subject github:12345 --json
```

Obtain a real feedback reference from an independent evaluator and use the intended account's numeric ID. `check` reads the receiving repository's policy at an immutable base commit. It never submits a PR. The [usage guide](docs/usage.md) covers registration, mapping, publication, retrieval, and withdrawal.

For the local workspace, run `bun install --frozen-lockfile`, `bun run build`, and `node scripts/serve.ts`, then open the printed URL. Verification needs no wallet; publication needs the relevant wallet and Sepolia gas. The [hosted workspace](https://geeknees.github.io/devouch/) is deployed separately and may still serve the ENS release until maintainers publish and verify 0.3.

## Adopt in a repository

Copy [the example policy](examples/erc8004/policy.json), review the deployment pins, set the receiving repository ID, and deliberately choose trusted evaluators. The starter policy trusts nobody. A contributor includes `.devouch/feedback/github-ID.json`; the Action binds it to the actual PR author's ID and reads policy at the base SHA. It never executes PR code.

Pin the Action to a reviewed ERC-8004 commit. Read evidence and policy fields: a green report job can contain missing, revoked, or rejected evidence. Follow [the adoption guide](docs/adoption-guide.md). CLI-capable agents can use the [devouch-check skill](skills/devouch-check/SKILL.md) for an already-authorized contribution workflow.

## Design and status

The controller declares an agent's GitHub ID; an independent evaluator supplies third-party feedback. Owners and approved operators cannot self-endorse. Each repository chooses its trusted evaluators, scopes, chain, and registry implementations. There is no global trust score, token incentive, automatic approval, or automatic merge. Public withdrawal preserves history and affects subsequent checks.

The [ERC-8004 evaluation](docs/erc8004-evaluation.md) explains the migration from ENS and its limits. Local contract, CLI, browser, and policy checks are distinct from the [public registry read observations](docs/erc8004-deployment.md). Real public wallet feedback/withdrawal and hosted ERC rollout remain separate release acceptance steps. This is test-network software; `human_verification` is `not_included`.

Devouch is inspired by [Mitchell Hashimoto's vouch](https://github.com/mitchellh/vouch), a separate implementation that also supports shared contributor lists. See [design principles](docs/design.md), [verification history](docs/history.md), and [the roadmap](docs/roadmap.md).

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

Use Bun 1.3.13 and Chrome/Chromium in addition to Ruby and Node.js. Integration tests rebuild `dist/` and use disposable local EVMs, never a funded public wallet. See [Contributing](CONTRIBUTING.md) for browser setup and reproducible distribution checks.

MIT licensed. [ERC-8004 fixture provenance](vendor/erc-8004/README.md) and bundled notices identify third-party code.
