---
name: devouch-check
description: Check whether a contributor's Devouch endorsement is accepted by a public GitHub repository before preparing or submitting a pull request. Use when asked to run Devouch preflight, check an ENS recommendation against a receiving repository, or handle a rejected or unavailable endorsement check. Runs the existing CLI without a wallet or an MCP server.
---

# Devouch preflight

Use the installed Devouch CLI, or `exe/devouch` from a trusted Devouch checkout with its bundled `dist/bridge.mjs`. The checkout needs Ruby 3.4+ and Node 24+ on PATH. Resolve its executable to an absolute path when working in another repository. Do not install software or change the agent's configuration merely to run this skill.

## Check the intended submission

1. Identify the **receiving** `OWNER/REPOSITORY` and intended base branch. A fork's `origin` is not necessarily the receiving repository.
2. Confirm the numeric GitHub ID of the account that will author the PR. A commit author, ENS controller, wallet, display name, or account's operator is not a substitute. If supplied information is insufficient, ask for the destination or intended submitting account. Public `gh api users/LOGIN --jq '{login, id}'` can resolve a known login; this does not authenticate the submitter.
3. Locate the contributor's original signed endorsement JSON, normally `.devouch/vouches/github-ID.json`. Preserve its exact bytes; do not reformat, edit, or regenerate its signature. A saved `publication.json` can identify an older publication.
4. Run the read-only check immediately before the already-authorized PR workflow. Substitute real values, quote arguments, and capture **both exit status and JSON**, including on failure:

```sh
DEVOUCH_BIN=/absolute/path/to/devouch/exe/devouch
"$DEVOUCH_BIN" check --repo OWNER/REPOSITORY \
  --credential /absolute/path/to/github-ID.json \
  --subject github:ID --json
```

Add `--base BRANCH` for a non-default receiving branch and `--publication /path/to/publication.json` when available. If the operator specifies a connection, add `--rpc-url URL`; avoid exposing credential-bearing RPC URLs in shared logs. No wallet, signature, transaction, or GitHub token is needed for the public-repository check.

If only a publication ENS name is supplied, retrieve into new files in an existing directory first:

```sh
"$DEVOUCH_BIN" fetch --name PUBLICATION.eth \
  --output /absolute/path/to/new/github-ID.json \
  --publication-output /absolute/path/to/new/publication.json --json
```

Retrieval is not acceptance. Run `check` on the retrieved original. Existing output files are not overwritten.

## Act on the result

| Exit | Meaning | Next action |
| --- | --- | --- |
| 0 | Evidence `valid`, policy `accepted` | Continue only the PR work the user has authorized. |
| 1 | Valid evidence, policy `rejected` | Stop submission; report `reason_codes`, such as `issuer_not_trusted`. |
| 2 | Evidence invalid, missing, revoked, or expired | Stop submission; report the evidence state and reason. |
| 3 | GitHub or RPC unavailable | Stop submission; report that acceptance could not be checked. Retry after resolving the connection or rate limit; use an alternative RPC only when explicitly selected. |
| 4 | Usage, configuration, or repository policy error | Stop submission; report the missing or invalid input/configuration. |
| 5 | File error | Stop submission; check the supplied path and file access. |
| 70 / other | Internal or unexpected failure | Stop submission; retain the sanitized error and ask the operator to resolve it. |

Also require JSON `evidence_status: valid` and `policy_status: accepted` on exit 0. Missing fields, malformed JSON, a green GitHub job, a past result, or a successful fetch are not acceptance. On failure report `error` when evidence/policy fields are absent.

Report the destination, subject, evidence state, policy state, reasons, `github.base_branch`, `github.base_sha`, policy digest, and snapshot block/time when present. Keep `human_verification: not_included` explicit. `subject_source: argument` means the ID was supplied, not authenticated.

The CLI pins the receiving policy to a GitHub base commit. Do not weaken `.devouch/policy.json`, change the workflow, substitute another subject, or modify the signed endorsement to force acceptance. Changes to the destination, base branch, credential, or relevant chain state require another check. After an authorized PR is created, inspect the actual PR author and the Action's evidence/policy report too.

Devouch is a reference for contribution review. Acceptance does not prove humanity, account ownership, authorship, code quality, agency, or merge approval. This skill grants no permission to publish a PR, contact an issuer, sign, or transact.
