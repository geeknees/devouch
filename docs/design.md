# Design principles

Devouch is a tool for contributor review. The issuer decides whom to recommend; the maintainer decides whose recommendations a repository accepts; reviewers judge the proposed change. These responsibilities remain separate.

## Evidence and policy

A recommendation can be valid and still be rejected by a repository. The verifier checks its signature, subject, scope, lifetime, publication, and withdrawal history. Repository policy chooses the trusted issuers and supported publication infrastructure. Devouch does not assign a global reputation score, reward activity with tokens, or treat a missing recommendation as proof of abuse.

An endorsement does not prove humanity, GitHub account ownership, authorship, agency, code quality, or permission to merge. `human_verification` is `not_included`. There is no automatic PR approval or merge.

## Infrastructure and costs

The current implementation publishes to the issuer's ENSv2 records. The static workspace, Ruby CLI, and read-only Action verify through RPC without a Devouch-operated API, database, shared signing key, or custom endorsement contract. Issuers control publication and withdrawal, and pay the transaction costs.

This moves responsibility to wallet management, ENS permissions, RPC availability, chain history, and maintainer-controlled deployment pins. The verifier fails with `unavailable` when it cannot retrieve required evidence; it does not reinterpret missing history as success. Revocation is reflected on the next check. Previously stored GitHub check results do not update automatically.

GitHub numeric IDs and recommendation relationships are public. Withdrawing a recommendation does not erase its historical transactions. Never publish secrets or private personal data in a credential or profile.

## Relationship to vouch

Devouch is inspired by [Mitchell Hashimoto's vouch](https://github.com/mitchellh/vouch/tree/d66fa29a64600490892131ad87597c30c91fcac4), a separate implementation focused on contributor recommendations and project-controlled acceptance. At that pinned revision, vouch already supports reading another repository's contributor list through `--vouched-repo`; cross-repository use is not unique to Devouch.

Devouch explores issuer-signed publication, expiry, and withdrawal history instead of depending on a particular repository's list. This brings wallet, gas, public-data, and RPC costs. It does not import vouch code, call its CLI or Action, or integrate with `VOUCHED.td`. See the pinned [README](https://github.com/mitchellh/vouch/blob/d66fa29a64600490892131ad87597c30c91fcac4/README.md) and [GitHub implementation](https://github.com/mitchellh/vouch/blob/d66fa29a64600490892131ad87597c30c91fcac4/vouch/github.nu).

## Identity integrations

An ENS agent profile is a controller's declaration, not proof that the controller owns the declared GitHub account. Profile editing permissions and contribution authority are different things.

World ID is not integrated. A future personhood integration must bind its proof to the intended subject and operation and work without a mandatory Devouch-operated secret or service. Personhood and a recommendation answer different questions. Any new integration requires its own verification of success, rejection, expiry, data exposure, and operational dependencies.

ERC-8004 is being evaluated in [Issue #25](https://github.com/geeknees/devouch/issues/25). Its third-party feedback model, transferable identities, and controller declarations need explicit treatment before replacing ENS. See [the roadmap](roadmap.md).
