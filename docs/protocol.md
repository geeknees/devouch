# ERC-8004 application profile

Devouch 0.3 supports one third-party recommendation per checked PR. It uses the standard Identity and Reputation registries with an application-specific public feedback payload. The implementation is pinned in [the fixture manifest](../vendor/erc-8004/manifest.json); the [evaluation](erc8004-evaluation.md) records the comparison with ENS.

## Evidence

A reference has exactly these fields:

```json
{
  "format": "devouch-erc8004-v1",
  "chainId": 11155111,
  "identityRegistry": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  "reputationRegistry": "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  "agentId": "42",
  "clientAddress": "0x1111111111111111111111111111111111111111",
  "feedbackIndex": "1",
  "feedbackBlock": "12000000"
}
```

The IDs and feedback above illustrate the format, not a verified public recommendation. Addresses must be nonzero; integer strings are canonical unsigned decimals. `agentId` is uint256; feedback index and block are bounded uint64 strings. Chain ID is a positive safe JSON integer. References and feedback data are limited to 4 KiB and reject duplicate/unknown keys and malformed UTF-8.

The controller sets Identity Registry metadata `devouch.github` to exact `github:ID` bytes. An independent evaluator calls `giveFeedback` with `value = 1`, `valueDecimals = 0`, `tag1 = oss-contribution`, `tag2 = devouch-feedback-v1`, and an empty endpoint. Its URI embeds UTF-8 JSON using `data:application/json;base64,`; `feedbackHash` is the SHA-256 of those exact JSON bytes. The payload contains exactly `format`, `subject`, `owner`, `scope`, `issuedAt`, and `expiresAt`. Time values are uint64 seconds; expiry must follow issuance and be no more than 366 days later. General ratings and external URI fetches are unsupported.

The authority is **the controller's declaration endorsed by the evaluator**. GitHub account ownership is `not_verified`, humanity is `not_included`, and no delegation or code quality claim is made. Registry owners/operators cannot give self-feedback.

## Verification

Normal checks use one finalized block, no more than one hour old or five minutes ahead of the verifier clock. RPC must expose historical state and logs. The reader:

1. Confirms chain ID and the Reputation Registry's link to the Identity Registry.
2. Resolves the exact publication event, hashes/decodes the embedded payload, and matches its subject and recommendation semantics.
3. Checks stored feedback, revocation, and expiry at the observation block.
4. Compares registry implementations and runtime code hashes at publication and observation.
5. Checks owner, GitHub mapping, and evaluator independence at both blocks.
6. Scans authority, mapping, and upgrade events, then rereads block hashes to detect snapshot changes.

Transfers, approval changes, mapping replacement, and registry upgrades invalidate prior feedback even when restored. Same-block authority changes are conservatively rejected. Logs are scanned in 2,000-block chunks with at most 2,000,000 blocks between publication and observation. Missing archive data, stale snapshots, unsupported history ranges, and RPC errors produce `unavailable`, never acceptance. A provider can lie or omit logs; the configured RPC and reviewed proxy/implementation pins remain trust dependencies. This is not a trustless proof of consensus or registry governance.

## Repository policy

`devouch-erc8004-policy-v1` contains exactly `format`, `repositoryId`, `chainId`, `trustedIssuers`, `allowedScopes`, `allowedRegistries`, and `requiredIssuers: 1`. Each registry entry pins both proxy addresses, both implementation addresses, both implementation code hashes, and both proxy code hashes. Lists are bounded to 64 entries; policy files are at most 16 KiB. The [example](../examples/erc8004/policy.json) starts with no trusted evaluators.

Only `valid` evidence reaches policy. Chain, issuer, scope, and registry pin mismatches produce `rejected`; otherwise the result is `accepted`. Other evidence states (`invalid`, `missing`, `revoked`, `expired`, `unavailable`) produce `not_evaluated`. `value = 1` is a recommendation marker, not an aggregate reputation score.

For PRs the subject is the numeric PR author ID, policy is read at the base SHA, and `.devouch/feedback/github-ID.json` at the head SHA. Only bounded JSON is read; PR code is never checked out or executed by the endorsement Action. Report mode completes successfully for evaluated rejection and missing/revoked/invalid/expired evidence; unavailable or malformed operation results fail the job. A green job is not an approval.

## Operations and compatibility

Unsigned wallet plans reconstruct calldata for `register`, `setMetadata`, `giveFeedback`, or `revokeFeedback`. Imports cannot supply arbitrary calldata or value. Before sending, the client verifies the wallet, chain, deployment pins, preparation block, 15-minute lifetime, relevant state, and call simulation. Pending public data is persisted before submission; uncertain delivery blocks duplicates. Receipt recovery verifies exact sender/destination/value/input and reads state at the receipt block. A mined receipt can precede finality; evidence checks still use finalized state.

ENS credentials and resolver policies fail with `legacy_ens_credential` and `legacy_ens_policy`. The report version is 2. There is no automatic conversion because self-endorsement and third-party feedback are different claims. See [migration and rollback](upgrading-0.3.md).
