# Verification history

This page records historical checks. It does not claim that old recommendations, public RPC availability, or hosted files remain unchanged today. Current behavior is documented in the [usage guide](usage.md) and [protocol](protocol.md).

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
