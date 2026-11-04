# Migrate from ENS 0.2 to ERC-8004 0.3

This is an incompatible protocol migration. Existing ENS JSON cannot be relabeled as ERC-8004 feedback. Owners and approved operators cannot recommend their own agent; obtain an independent evaluator.

| Surface | 0.3 behavior |
|---|---|
| Reference | `devouch-erc8004-v1`, explicit registries, agent/evaluator/index/publication block |
| Policy | `devouch-erc8004-policy-v1`, explicit registry implementation/proxy code pins |
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

Update the Action's immutable commit and repository policy together through a normal PR. Place new references at `.devouch/feedback/github-ID.json`. Use `devouch check`, then check an actual PR against the migrated base. The migration PR's own base still contains the ENS policy and may report `legacy_ens_policy`; after merge the new base policy can be read. A missing reference completes as `missing / not_evaluated` in report mode, while no evaluator is trusted by the starter policy.

Deploy the reviewed static distribution separately using the release runbook. Do not describe the hosted workspace as migrated until its bytes are read back. Test approval, rejection, missing evidence, public RPC failure, withdrawal, and recovery with your actual deployment. The included suite verifies local contracts, CLI, policy parity, Action boundaries, and browser recovery; it does not replace public wallet acceptance testing.

## Rollback

The previous reviewed source is [`32b9eeb7990724696dbb5fb2ee50afd2a6f5822c`](https://github.com/geeknees/devouch/tree/32b9eeb7990724696dbb5fb2ee50afd2a6f5822c); historical Action and Pages evidence is in [history](history.md). Restore a reviewed ENS distribution, its compatible policy, evidence paths, and Action pin together through a new PR and manual Pages publication. Preserve new ERC references and recovery files separately. Finish uncertain ERC sends with the ERC app before switching UI versions.

Rollback does not undo public transactions, erase feedback, restore expired/revoked recommendations, or make ERC evidence readable by ENS clients. Do not relax policy to hide a failed check. Review registry operations and trust configuration independently of the code rollback.
