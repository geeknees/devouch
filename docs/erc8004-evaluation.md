# ERC-8004 evaluation

This page records the isolated PoC in PR #26. The subsequent product migration is documented in [upgrading to 0.3](upgrading-0.3.md); references below to the unchanged ENS product describe the PoC boundary.

This implements [Issue #25](https://github.com/geeknees/devouch/issues/25): read one third-party feedback on a disposable local EVM, validate its evidence, and apply two independent repository policies. It adds an evaluation path alongside the ENS application. It does not change the existing CLI, web workspace, Action, or ENS policy format.

## Reproduce

Use Node.js 24 and Bun 1.3.13 with the repository's existing dependencies:

```sh
bun install --frozen-lockfile
bun test test/ts/erc8004.test.ts
node scripts/evaluate-erc8004.ts test
node scripts/evaluate-erc8004.ts demo
```

The runner starts a loopback EVM, deploys the vendored official bytecode, registers an agent, declares a GitHub subject, grants a token operator, and publishes feedback from a different account. It closes the EVM on exit. No public RPC, wallet secret, funded account, external API, or Devouch contract is required. The integration file also runs in `bun run test:integration` under the existing CI workflow.

The demo prints the reference, policy, registry/implementation addresses and code hashes, observation block number/hash/timestamp, transaction hash, and both decisions. Addresses are local fixtures, **not public deployments**, even though this local chain uses the existing test chain ID `11155111`.

| Fixed input | Version |
|---|---|
| ERC text, still Draft at the pinned revision | [`ethereum/ERCs@503591a6e80e6e1affdd6403341e25269141f046`](https://github.com/ethereum/ERCs/blob/503591a6e80e6e1affdd6403341e25269141f046/ERCS/erc-8004.md) |
| Official implementation | [`erc-8004/erc-8004-contracts@b9e466c250744a7e06b13dff9d3c2844ed64f825`](https://github.com/erc-8004/erc-8004-contracts/tree/b9e466c250744a7e06b13dff9d3c2844ed64f825) |
| Compiler | Solidity `0.8.24+commit.e11b9ed9`, Shanghai, IR, optimizer 200 runs |
| OpenZeppelin | `5.4.0` |
| Local first mined timestamp | `2000000000` (synthetic fixture time) |

Source bytes, compiler input, bytecode, ABI, and SHA-256 checksums are in [`vendor/erc-8004`](../vendor/erc-8004/README.md). The fixture uses the official `MinimalUUPS` bootstrap and OpenZeppelin `ERC1967Proxy`, then upgrades to the official registries. Only the bootstrap's hard-coded owner is impersonated locally. This is a fixture setup operation, not a public deployment recipe.

## Observed results

The local EVM run on 2026-11-04 produced a feedback at block **11**, observed at block **11**, with timestamp `2000000000`, agent ID `0`, and subject `github:12345`.

| Case | Result |
|---|---|
| Same third-party feedback, repo A trusts the evaluator | `valid / accepted` |
| Same feedback, repo B does not trust the evaluator | `valid / rejected`, `issuer_not_trusted` |
| Owner, token-approved operator, or operator-for-all gives feedback | Official contract reverts with `Self-feedback not allowed` |
| Evaluator revokes feedback | `revoked / not_evaluated` |
| Observation timestamp reaches application expiry | `expired / not_evaluated` |
| Expected GitHub subject differs | `invalid / not_evaluated`, `subject_mismatch` |
| Feedback index does not exist | `missing / not_evaluated` |
| RPC or history retrieval fails | `unavailable / not_evaluated`; provider details are not returned |
| Transfer away and back, or change and restore token operator | `invalid / not_evaluated`, `agent_authority_changed` |
| Change and restore the GitHub mapping | `invalid / not_evaluated`, `github_mapping_changed` |
| Upgrade and restore an identity implementation | `invalid / not_evaluated`, `registry_changed` |
| Changed application data or negative feedback | Hash mismatch or unsupported semantics; never accepted |

These are real local transactions and reads against the pinned contracts. They do not establish public-chain availability, deployed-contract equivalence, independent adoption, or production readiness.

## Identity and application semantics

An evidence reference names **chain ID + Identity Registry + agent ID**, the Reputation Registry, evaluator (`clientAddress`), feedback index, and publication block. An agent ID is transferable, can be zero, and is never interpreted as a GitHub numeric ID.

The agent controller sets `devouch.github` metadata to the exact `github:ID` bytes. The evaluator commits this data in a `data:application/json;base64,...` feedback URI and its SHA-256 `feedbackHash`:

```json
{
  "format": "devouch-feedback-v1",
  "subject": "github:12345",
  "owner": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  "scope": "oss-contribution",
  "issuedAt": "2000000000",
  "expiresAt": "2000003600"
}
```

The mapping's authority is **the agent controller's declaration, endorsed by the feedback issuer**. It is not proof of GitHub account ownership or authority to submit a PR. The evidence explicitly returns `account_ownership: not_verified`. A PR integration must still bind the subject to GitHub's actual PR author ID and read policy from the base SHA.

This application profile accepts only `value = 1`, `valueDecimals = 0`, `tag1 = scope`, and `tag2 = devouch-feedback-v1`. A general ERC rating is not silently treated as a recommendation. Scope, positive endorsement meaning, issued time, expiry (maximum 366 days), and GitHub mapping are **Devouch rules**, not ERC guarantees. Negative feedback is unsupported, not a negative global score. The pinned implementation's `±10^38` cap differs from the text's `int128` domain; this profile uses only `1` and makes no general numerical compatibility claim.

The reader uses a finalized observation block by default and rejects a snapshot over an hour old or over five minutes in the future. The local fixture supplies its exact mined block explicitly for historical replay. Every state read uses that block or the publication block. It compares event data with stored feedback, validates the hash, checks owner/mapping/third-party status at both blocks, scans relevant authority/mapping/upgrade events, and rereads block hashes to detect a changed snapshot. History is read in 2,000-block chunks with a maximum 2,000,000-block interval; failures or unsupported intervals remain unavailable. Same-block authority changes conservatively require new feedback.

The embedded URI avoids an off-chain host and arbitrary URL fetching. An external URI returns `feedback_data_unavailable`; this PoC does not claim generic ERC feedback URI support. The JSON reference alone cannot reconstruct missing committed application data.

## Policy and ENS comparison

ERC policy has its own `devouch-erc8004-policy-v1` format. `allowedRegistries` pins both registry addresses, both implementation addresses, and their implementation/proxy runtime code hashes. Chain ID is explicit. Addresses or hashes printed by an untrusted RPC are observations, not a recommendation to trust those deployments. Maintainers choose and review their allowed deployment pins.

| Existing ENS rule | ERC path | Decision |
|---|---|---|
| Signature proves the endorsement issuer | Official feedback event identifies its transaction-authorized evaluator; data hash binds the extension | Replace |
| ENS name, hierarchy, DNS encoding, linked records | Identity/Reputation Registry and agent ID | Remove ENS-specific routing |
| Resolver implementation and allowed resolver | Explicit registry/implementation/code pins | Replace; a registry is not a resolver |
| One active recommendation per resolver record | Independent feedback index per evaluator/agent | Remove record-slot restriction |
| Current text plus complete withdrawal history | Stored `isRevoked` plus exact publication event | Simplify withdrawal checks |
| ENS owner/roles changing invalidates an old recommendation | Agent transfer/operator/mapping/registry upgrade history invalidates it | Retain conservative invalidation |
| Restore old state does not revive an endorsement | History still rejects the old feedback | Retain |
| Subject, scope, lifetime | Committed extension plus current/historical mapping | Retain application rules |
| Repo chooses trusted issuer and allowed scope | Same independent decision with ERC deployment pins | Retain |
| Manager can endorse their own agent | Owner/operator self-feedback is forbidden | Incompatible; obtain an independent evaluator |
| No central Devouch service | Static clients, event-embedded data, public RPC reads | Retain |
| No human/account ownership/quality/merge guarantee | Same limitations, explicit declaration authority | Retain |

The existing ENS parser, policy fields, output, and commands remain unchanged in this PoC. ERC evidence reuses the same evidence statuses and `accepted / rejected / not_evaluated` decision vocabulary, while adding registry-specific observations. No conversion of an ENS credential into third-party feedback is implied.

## Decision

**Proceed with ERC-8004 for the third-party endorsement model in a separate migration PR.** The experiment confirms that per-repository trust decisions survive, a separate endorsement signature and ENS hierarchy resolution can be removed, and revocation can use the standard registry flag. The requested migration adopts a narrower product model: a manager's self-endorsement is not migrated as third-party reputation.

ERC-8004 does not eliminate identity mapping, expiry, policy, snapshot verification, upgrade trust, or historical RPC dependence. Registry admin keys and RPC providers remain dependencies; there is no mandatory Devouch backend. Public deployment pins, a new evidence/policy format, operator instructions, rollback, and actual public read verification belong to the separate migration. No custom contract, central backend, automatic approval, or automatic merge is proposed.
