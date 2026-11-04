# CLI reference

Use Ruby 3.4+ and Node.js 24. Run `./exe/devouch COMMAND --help` for current options; [usage](usage.md#cli) provides examples.

| Command | Required options | Optional options |
|---|---|---|
| `register` | `--owner`, `--output` | `--deployment` |
| `map` | `--owner`, `--agent-id`, `--subject`, `--output` | `--deployment` |
| `request` | `--issuer`, `--agent-id`, `--subject`, `--expires-at`, `--output` | `--deployment` |
| `fetch` | `--agent-id`, `--issuer`, `--feedback-index`, `--feedback-block`, `--output` | `--deployment` |
| `verify` | `--credential`, `--policy`, `--subject` | — |
| `check` | `--repo`, `--credential`, `--subject` | `--base` |
| `revoke` | `--credential`, `--output` | `--deployment` |

Every command supports `--rpc-url URL`, `--json`, and `--help`. `--version` reports `0.3.0`. RPC selection is the explicit option, then `DEVOUCH_RPC_URL`, then `https://rpc.sepolia.ethpandaops.io`. There is no automatic fallback. The default reviewed registry pins are in [configuration](../config/erc8004-sepolia.json).

`register`, `map`, `request`, and `revoke` prepare **unsent** wallet plans. `fetch` retrieves a feedback reference; it does not prove acceptance. `verify` uses a local policy. `check` reads a public repository's policy at a fixed base commit. No CLI command submits a transaction or PR. Output files are never overwritten.

Subjects are `github:<numeric ID>`. Agent IDs are separate canonical decimal strings and may be zero. Feedback indices start at one. Expiry is an explicit future RFC 3339 timestamp with a timezone and cannot exceed the profile's 366-day lifetime. `--repo` is `OWNER/REPOSITORY`; `--base` defaults to its default branch. Legacy `--name`, `--publication`, and `--publication-output` options are rejected.

## Results and exit codes

Verification emits `report_version: 2`, `command`, `evidence_status`, `policy_status`, `reason_codes`, `subject`, `subject_source`, `issuer`, `scope`, `policy`, `verifier_version`, and `snapshot`. Valid evidence also includes `registry`, `feedback`, and `declaration.account_ownership: not_verified`. `check` includes `submitted: false`, the receiving repository, branch, SHA, and policy digest.

`subject_source: argument` is a caller declaration, not authentication. The Action and PR URL flow bind it to the actual PR author. `human_verification` is always `not_included`.

| Exit | Meaning |
|---|---|
| 0 | Evidence accepted, or retrieval/preparation completed |
| 1 | Valid evidence rejected by repository policy |
| 2 | Invalid, missing, revoked, or expired evidence |
| 3 | GitHub/RPC or required history unavailable |
| 4 | Usage, configuration, or policy error |
| 5 | File error |
| 70 | Internal failure |

A successful preparation or fetch is not an accepted check. Only `valid / accepted` supports an otherwise authorized contribution preflight. Recheck after policy or chain changes.
