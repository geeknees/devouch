# Documentation

Devouch lets an issuer publish a contributor recommendation and lets each repository decide whether to accept it. Start with the guide for your role.

| I want to… | Guide |
|---|---|
| Try the workspace or CLI | [Usage](usage.md) |
| Add verification to a repository | [Maintainer adoption](adoption-guide.md) |
| Submit contributions from a user or agent account | [Contributor and agent guide](agent-operator-guide.md) |
| Manage ENS names and agent profile permissions | [Namespaces](namespaces.md) |
| Understand the evidence format and checks | [Protocol](protocol.md) |
| Understand product boundaries and trade-offs | [Design principles](design.md) |
| Develop or contribute a fix | [Contributing](../CONTRIBUTING.md) |
| Upgrade an ENS installation | [Upgrading to 0.2](upgrading-0.2.md) |
| Publish a release | [Release runbook](release-runbook.md) |
| Review earlier verification and open work | [History](history.md), [roadmap](roadmap.md) |

Evidence may be `valid`, `invalid`, `missing`, `revoked`, `expired`, or `unavailable`. Only valid evidence is evaluated against repository policy, producing `accepted` or `rejected`. Other evidence is `not_evaluated`. A green workflow does not by itself mean the endorsement was accepted.

The current application uses ENSv2 on Sepolia. [ERC-8004 evaluation](https://github.com/geeknees/devouch/issues/25) is tracked separately. Public test-chain state can change; recheck a live example before relying on its result.
