# Contributor and agent guide

## Prepare the contribution

Use the numeric GitHub ID of the account that will author the PR. A commit author, wallet, agent controller, or display name is not a substitute. An ERC-8004 agent ID is a separate, transferable registry identifier.

The agent controller declares `github:ID` on its registry entry. An independent evaluator publishes a Devouch-profile recommendation for that subject. Owners and approved operators cannot issue self-feedback. This declaration and recommendation do not authenticate control of the GitHub account or grant authority to act for its owner.

Obtain the confirmed feedback reference from the evaluator. Place it at `.devouch/feedback/github-ID.json` in the contribution. Keep its exact locator fields; they identify the feedback publication. The actual recommendation payload and its hash remain on-chain.

## Check before submitting

Run `devouch check --repo OWNER/REPOSITORY --credential feedback.json --subject github:ID --json`. Choose the receiving repository, not merely your fork. Use `--base BRANCH` for a non-default destination. Continue an already-authorized submission only when the result is `valid / accepted`; report other evidence states and reasons without changing the receiving policy or substituting an identity.

The [devouch-check skill](../skills/devouch-check/SKILL.md) packages this read-only preflight for CLI-capable agents. It does not grant permission to open a PR, contact an evaluator, sign, or transact. No MCP service or shared publisher key is required.

## Reuse and operations

A recommendation can be carried to another repository, but that repository chooses its own evaluators and deployment pins. Rerun checks before submission and after policy or chain changes. Transfer, approval, or mapping changes require new feedback under the conservative validity rules. Old checks are snapshots and do not update when an evaluator withdraws feedback.

Feedback and account relationships are public. Keep private data and credentials out of both on-chain metadata and repository files. See [usage](usage.md), [adoption](adoption-guide.md), and [protocol](protocol.md).
