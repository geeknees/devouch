# CLI reference

Use Ruby 3.4+ and Node.js 24. Run `./exe/devouch --help` or `./exe/devouch COMMAND --help` for the executable's current option list. The [usage guide](usage.md#cli) provides complete examples.

## Commands

| Command | Required options | Optional options |
|---|---|---|
| `request` | `--subject`, `--issuer`, `--name`, `--expires-at`, `--output` | — |
| `fetch` | `--name`, `--output` | `--publication`, `--publication-output` |
| `verify` | `--credential`, `--policy`, `--subject` | `--publication` |
| `check` | `--repo`, `--credential`, `--subject` | `--base`, `--publication` |
| `revoke` | `--credential`, `--output` | — |

Every command supports `--rpc-url URL`, `--json`, and `--help`. `--version` reports the distribution version. The RPC is chosen from the explicit option, then `DEVOUCH_RPC_URL`, then the application's public Sepolia default. The CLI does not silently fail over to another endpoint.

`request` and `revoke` prepare **unsent** files for the wallet workspace. `fetch` retrieves original bytes and optionally their publication position; retrieving a file is not a validity check. `verify` checks evidence against a supplied local policy. `check` retrieves a public repository's policy at a fixed base commit and verifies locally; it does not create or update a PR.

Subjects use `github:<numeric ID>`, not a login name or ENS label. `--repo` uses `OWNER/REPOSITORY`; `--base` selects a destination branch, otherwise the default branch is used. Existing output files are not overwritten. Keep signed credential bytes intact; editing or reformatting them can invalidate publication comparison.

## Results and exit codes

Verification JSON includes `report_version`, `command`, `evidence_status`, `policy_status`, `reason_codes`, `subject`, `subject_source`, `issuer`, `scope`, `policy`, `verifier_version`, and `snapshot`. ENS hierarchy details are included when available. `check` also includes `submitted: false` and the checked GitHub repository, branch, SHA, and policy digest.

`subject_source: argument` means the ID came from the caller. It is not authentication. Only the Action or PR URL verifier binds the subject to an actual PR author. `human_verification` is always `not_included`.

| Exit | Meaning |
|---|---|
| 0 | Evidence accepted, or a requested retrieval/preparation completed |
| 1 | Valid evidence rejected by repository policy |
| 2 | Invalid, missing, revoked, or expired evidence |
| 3 | GitHub/RPC or required history unavailable |
| 4 | Usage, configuration, or policy error |
| 5 | File error |
| 70 | Internal failure |

For a contribution preflight, continue an otherwise authorized submission only after `check` exits 0. A successful `request` or `fetch` is not equivalent to an accepted `check`. Recheck after relevant policy or chain changes. The [protocol](protocol.md) defines the supported evidence and history boundaries.
