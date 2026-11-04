# Contributor and agent guide

Devouch verifies the recommendation for the account that actually opens a PR. A human-operated account, an agent account, and a GitHub App bot may have different numeric IDs. The person running an agent and a commit's author are not necessarily the PR author.

## Prepare the contribution

1. Read the destination repository's contribution rules and identify the account that will submit the PR. Use its numeric GitHub ID, not its login name.
2. Obtain an endorsement from an issuer accepted by that repository. Check its subject, scope, expiry, and publication. The [maintainer guide](adoption-guide.md) explains the repository policy; the [protocol](protocol.md) describes the signed format.
3. Save the original JSON without editing or formatting it as `.devouch/vouches/github-ID.json` in the contribution branch. Never request or copy the issuer's private key.
4. Make the requested code change and run its tests. Keep the destination's maintainer-controlled policy and workflow intact.

The endorsement and its GitHub subject are public data. Withdrawal does not erase the historical publication. A controller-declared agent profile does not prove GitHub account ownership or delegation.

## Check before submitting

With the destination repository, actual author ID, and original file:

```sh
./exe/devouch check --repo OWNER/REPOSITORY \
  --credential .devouch/vouches/github-12345.json \
  --subject github:12345 --json
```

Add `--base BRANCH` for a non-default destination. `check` retrieves the policy from a fixed commit of that branch. It reads public GitHub data and RPC state without a wallet or GitHub token and does not submit a PR.

Continue an otherwise authorized submission only on exit **0**. Report other outcomes to the operator or maintainer; do not modify policy just to gain acceptance. The portable [devouch-check skill](../skills/devouch-check/SKILL.md) documents the same flow for CLI-capable agents. See [CLI results](cli-interface.md#results-and-exit-codes).

A successful check does not grant posting permission. Submit through the account and process authorized for the task, then confirm that the PR author's ID matches the report's subject. Recheck if policy or chain state changes.

## Interpret the Action

| Evidence and policy | Next step |
|---|---|
| `valid / accepted` | Follow normal review; there is no code or merge approval |
| `valid / rejected` | Review `reason_codes` with the maintainer; trust and allowed scope are local choices |
| `missing` | Check the author-specific file and ENS publication |
| `invalid` | Check subject, original bytes, and authority/history changes |
| `expired` | Ask the issuer for a new endorsement |
| `revoked` | The issuer withdrew it; resending old JSON does not repair it |
| `unavailable` | Resolve RPC/GitHub availability; acceptance has not been established |

The Action reads policy at the PR's base SHA and evidence at its head SHA. A green report workflow alone does not mean acceptance. Previous check results do not update when an endorsement is later withdrawn; rerun to get a fresh observation.

## Reuse and operations

A still-valid endorsement can be included in another repository, but that repository applies its own policy. If the credential is already in a repository, later PRs can reuse the file while its state is rechecked. Switching the posting account requires a recommendation for the new account's ID.

Stopping an agent or revoking its GitHub access is an operator action separate from withdrawing its endorsement. Sharing a GitHub App bot does not make the bot's single numeric ID an identity for every operator or installation. Devouch does not infer those relationships.

Issuers publish and withdraw through the [workspace](usage.md); [namespaces](namespaces.md) explains ENS agent profiles and their limited editing permissions. Ordinary contributions require no blockchain write. Humans still decide whether to recommend a contributor and whether to accept a change.
