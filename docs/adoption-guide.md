# Adopt Devouch in a repository

A maintainer chooses trusted evaluators. Devouch reports evidence and repository acceptance; reviewers still decide whether to merge a contribution.

## Configure policy

Copy [the ERC-8004 example policy](../examples/erc8004/policy.json) to `.devouch/erc8004-policy.json`. Set `repositoryId` to the receiving `OWNER/REPOSITORY`. Review the chain, proxy and implementation addresses, and code hashes against independently checked deployment information. The example pins the observed official Sepolia deployment; an RPC observation alone is not a trust recommendation.

Set `trustedIssuers` to the public wallet addresses of evaluators you deliberately trust for `oss-contribution`. The example and Devouch's own initial migration policy use `[]`, so no recommendation is accepted until maintainers choose evaluators. Do not copy an old ENS issuer into the list merely to make a check pass: the agent owner and operators cannot be their own ERC evaluator. No private key belongs in policy.

One reference and one evaluator are checked per PR (`requiredIssuers: 1`). Multiple allowed evaluators or reviewed registry deployments can be listed, up to 64 entries. Policies are receiving-repository decisions, not a universal trust list. See [protocol details](protocol.md).

## Configure the read-only Action

Merge the ERC policy into the destination branch before adding the workflow so the first report can read it from the PR base. Copy [the repository workflow](../.github/workflows/devouch.yml), and pin `uses: geeknees/devouch@...` to the exact reviewed ERC-8004 commit. Use `policy-path: .devouch/erc8004-policy.json`; do not use the ENS 0.2 Action with a 0.3 policy. Keep `mode: report`, `contents: read`, and `pull-requests: read`. The normal GitHub token is enough; no PAT, wallet key, or custom secret is required for public repositories and the default public RPC.

The endorsement job must not check out, install, build, or execute code from the PR. The composite Action runs its own pinned distribution and reads only GitHub JSON and registry state. Regular project tests belong in separate jobs. The `rpc-url` input selects the provider explicitly; failures are reported without fallback.

## Submit and read the result

A contributor obtains feedback from an independent evaluator and places its reference in `.devouch/feedback/github-ID.json`, where ID is the numeric account ID that will open the PR. They may use `devouch check` as a preflight; the Action independently uses the actual PR author's ID.

Review `evidence_status`, `policy_status`, reasons, the policy digest, base/head SHAs, and the chain snapshot. A green report can say `missing`, `revoked`, or `rejected`. It means evaluation completed, not that code is approved. `unavailable` means the check could not be completed and must not be treated as acceptance. Rerun after a withdrawal or relevant state change.

Initial fork workflow approval may be required by GitHub's repository settings. This project does not auto-approve or merge PRs, authenticate GitHub account ownership through a wallet, or attest code quality.

## Rollout

For an ENS installation, follow [the two-stage upgrade guide](upgrading-0.3.md): merge the ERC policy at its separate path while the ENS workflow remains active, then switch the workflow pin/path and clients in a second PR. Verify that second PR against the already staged base policy before merging. A missing policy or `legacy_ens_policy` is a configuration error to resolve, not rejected contributor evidence. Rerunning a pre-migration event retains its old base SHA; use a fresh PR event after the preparation merge.

Hosted Pages and consumer Action pins are separate release steps. [The release runbook](release-runbook.md) includes public retrieval/readback checks. Local EVM tests and public deployment reads are not evidence that a real public wallet feedback/revocation flow has been rehearsed.
