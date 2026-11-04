# Verification history

This page records historical checks. It does not claim that old recommendations, public RPC availability, or hosted files remain unchanged today. Current behavior is documented in the [usage guide](usage.md) and [protocol](protocol.md).

## ERC-8004 0.3 — 2026-11-05 JST

[PR #26](https://github.com/geeknees/devouch/pull/26) evaluated ERC-8004, [#27](https://github.com/geeknees/devouch/pull/27) replaced event material with OSS guides, [#29](https://github.com/geeknees/devouch/pull/29) staged the separate ERC policy, and [#28](https://github.com/geeknees/devouch/pull/28) migrated the application. Staging `.devouch/erc8004-policy.json` before switching consumers resolved the old base-policy mismatch without trusting policy from the PR head. The initial evaluator list is empty.

| Recorded artifact | Evidence |
|---|---|
| Fixed Action commit | `0749383ec4b728b5d5490397b6baf7008b48e79a` |
| Merged source / Pages commit | `75db7faa6e11d1972361e1cfa49f7f35d420135f` |
| PR tests | [Run 41853777428](https://github.com/geeknees/devouch/actions/runs/41853777428), success |
| Main tests | [Run 41854615130](https://github.com/geeknees/devouch/actions/runs/41854615130), success |
| Actual PR report | [Run 41853777449](https://github.com/geeknees/devouch/actions/runs/41853777449), `missing / not_evaluated`, `credential_missing` |
| Pages publication | [Run 41855002243](https://github.com/geeknees/devouch/actions/runs/41855002243), success |
| Public workspace | [geeknees.github.io/devouch](https://geeknees.github.io/devouch/) |

Local checks covered 72 Ruby tests (389 assertions), 80 TypeScript tests, and 15 local EVM/browser integration tests. Hosted CI passed the same suites and distribution rebuild comparison. The preparation PR retained the existing ENS `history_budget_exceeded` report; the migration PR completed with the compatible base policy.

All 11 hosted HTML, JavaScript, CSS, logo, notice, and font files matched the deployed source bytes, as did the `/devouch/` entry response. Clean Chromium sessions at 1440px and 390px passed navigation, font loading, theme persistence, and horizontal overflow checks with no page errors or failed site assets. Desktop and mobile screenshots were inspected.

Public-site verification of #28 without a wallet returned `missing / not_evaluated` for `github:701242`, matching the Action. Both read base `573f9344678a4edc0e8f80738092895fa3b413f7`, head `b17e7304d2db565d577c34c21e6b6fa58c2993c4`, and policy digest `sha256:75573e4ee40748a71fc019aa06c3b902195027ef0ae3349c7a8f2e08ed1a43f6`. This verifies policy selection and missing evidence, not accepted feedback or a chain snapshot. Public-wallet issuance/withdrawal and accepted public contributor evidence remain unverified; this rollout sent no public-chain transaction.

## ENS 0.2 — 2026-09-26

[PR #17](https://github.com/geeknees/devouch/pull/17) added hierarchical ENS names, independently withdrawable recommendations, agent profile permissions, and maintainer setup. The distribution version became `0.2.0`; the signed credential and report formats remained version 1.

| Recorded artifact | Evidence |
|---|---|
| Fixed Action commit | `4aa03f7f6bea64701a6bbab0ff6420df1457b2fb` |
| Merge and Pages source commit | `046417f906852ae9432767a4f1872494c98047ee` |
| Main tests | [Run 36219981222](https://github.com/geeknees/devouch/actions/runs/36219981222), recorded success |
| Actual PR endorsement | [Run 36219802283](https://github.com/geeknees/devouch/actions/runs/36219802283), recorded `valid / accepted`, verifier `0.2.0` |
| Pages publication | [Run 36220008983](https://github.com/geeknees/devouch/actions/runs/36220008983), recorded success |

Local and hosted checks at that revision covered 70 Ruby tests, 99 TypeScript tests, and 52 integration tests. The integration suite compared the pinned 0.1 distribution against the same ENS state. Source/build parity, public retrieval of the fixed Action, and the published workspace were checked separately.

Sepolia wallet checks also exercised publishing and withdrawing independent subname recommendations and granting, updating, and revoking agent profile permissions. This does not claim that every historical root-name recommendation had its withdrawal rehearsed, or that a local EVM test proves public-chain behavior. Original transaction-level records remain available at the [recorded source revision](https://github.com/geeknees/devouch/blob/32b9eeb7990724696dbb5fb2ee50afd2a6f5822c/docs/sepolia-namespace-check.md).

The original release details are in [the versioned release record](https://github.com/geeknees/devouch/blob/32b9eeb7990724696dbb5fb2ee50afd2a6f5822c/docs/release-evidence.md). Keeping those immutable links preserves detailed evidence while the current documentation stays focused on using and maintaining the project.
