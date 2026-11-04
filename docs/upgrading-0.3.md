# Migrate from ENS 0.2 to ERC-8004 0.3

This is an incompatible protocol migration. Existing ENS JSON cannot be relabeled as ERC-8004 feedback. Owners and approved operators cannot recommend their own agent; obtain an independent evaluator.

| Surface | 0.3 behavior |
|---|---|
| Reference | `devouch-erc8004-v1`, explicit registries, agent/evaluator/index/publication block |
| Policy | `.devouch/erc8004-policy.json`, `devouch-erc8004-policy-v1`, explicit registry implementation/proxy code pins |
| PR evidence path | `.devouch/feedback/github-ID.json` |
| CLI / package | `0.3.0` |
| Report | `report_version: 2`, registry/feedback/declaration fields |
| Signing | A wallet registry transaction replaces the separate ENS endorsement signature |
| ENS names, subnames, profiles, resolver grants, lists | Removed from this application; existing on-chain ENS state is untouched |

## Before switching

1. Preserve your ENS credentials, public references, policy, reviewed Action commit, and any pending transaction recovery files. Complete pending ENS operations with the old application. ERC recovery cannot interpret the old format.
2. Review [the evaluation](erc8004-evaluation.md), [protocol](protocol.md), and selected [deployment pins](../config/erc8004-sepolia.json). The built-in deployment is Sepolia, not Ethereum mainnet. Upgradeable registry administrators and historical RPC availability remain dependencies.
3. Choose independent evaluators for each receiving repository. Trust is not automatically migrated. The starter policy deliberately trusts no evaluator.
4. Have each controller register an agent and declare the intended GitHub numeric ID. Have an independent evaluator publish new Devouch-profile feedback and retain the confirmed locator. The controller/evaluator declaration is not proof of GitHub account ownership.

## Switch consumers

Use two reviewed PRs so the new verifier can read a compatible policy from its immutable base commit:

1. **Stage the ERC policy.** Add `.devouch/erc8004-policy.json` from the example, set the repository ID, and review its deployment pins and trust list. Keep the existing `.devouch/policy.json` and ENS Action unchanged. Merge this preparation PR first. The old ENS report still describes ENS evidence; an existing ENS retrieval failure is not fixed by staging a dormant file.
2. **Switch consumers.** Base the migration PR on that merged preparation. Update the Action's immutable commit and `policy-path` to `.devouch/erc8004-policy.json`, switch CLI/Web consumers to 0.3, and remove the old ENS policy and credential files after preserving them. Place new references at `.devouch/feedback/github-ID.json`. Verify the migration PR's actual Action report before merging.

The Action, CLI `check`, and Web PR verifier use the same ERC policy path. They never substitute policy from the PR head or fall back to the ENS policy. A missing staged policy is a configuration failure; `legacy_ens_policy` is a configuration mismatch that must be corrected before switching. Push a new commit, or open/reopen the migration PR, after the preparation merge to trigger a fresh report. Rerunning an old event keeps its old base/head SHAs.

A missing reference completes as `missing / not_evaluated` in report mode. This is a completed absence check, not an accepted endorsement. The starter policy trusts no evaluator. Confirm the reported policy digest and base SHA, then use `devouch check` and an actual PR for any later trust or evidence changes.

Deploy the reviewed static distribution separately using the release runbook. Do not describe the hosted workspace as migrated until its bytes are read back. Test approval, rejection, missing evidence, public RPC failure, withdrawal, and recovery with your actual deployment. The included suite verifies local contracts, CLI, policy parity, Action boundaries, and browser recovery; it does not replace public wallet acceptance testing.

## Rollback

The previous reviewed source is [`32b9eeb7990724696dbb5fb2ee50afd2a6f5822c`](https://github.com/geeknees/devouch/tree/32b9eeb7990724696dbb5fb2ee50afd2a6f5822c); historical Action and Pages evidence is in [history](history.md). First restore the compatible ENS policy at `.devouch/policy.json` through a preparation PR while the ERC consumers keep reading `.devouch/erc8004-policy.json`. Then switch the reviewed ENS distribution, evidence paths, and Action pin/path through another PR and manual Pages publication. Preserve the ERC policy, references, and recovery files separately. Finish uncertain ERC sends with the ERC app before switching UI versions.

Rollback does not undo public transactions, erase feedback, restore expired/revoked recommendations, or make ERC evidence readable by ENS clients. Do not relax policy to hide a failed check. Review registry operations and trust configuration independently of the code rollback.
