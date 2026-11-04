# Release runbook

Maintainers publish the reviewed distribution and its immutable Action reference separately from the hosted static workspace. A PR or push does not deploy Pages; publication is a manual workflow.

## Prepare

1. Run the checks in [Contributing](../CONTRIBUTING.md), regenerate `dist/`, and review the source/distribution diff. Keep third-party notices and font licenses.
2. Check the release diff for private data, keys, tokens, credential-bearing endpoints, and local runtime files. Do not commit `.devouch/local/`, recordings, or raw provider logs.
3. Use a reviewed feature branch and normal PR process. Record the exact head SHA and hosted Test result. Never use a test result from a different commit as release evidence.
4. Read the applicable [upgrade guide](upgrading-0.2.md). Identify policy and credential compatibility changes and a reviewed rollback target.

## Publish the Action

Record the reviewed commit SHA. Verify that an unauthenticated client can retrieve that commit's `action.yml`, `dist/bridge.mjs`, and Ruby support files, and compare them with the tested release. Consumers pin this immutable SHA in their workflow. Updating a tag or hosting the web app does not update a consumer's pinned Action.

The [adoption guide](adoption-guide.md) describes report mode and read-only permissions. Test with the actual PR author's numeric ID, base policy SHA, and head evidence SHA. A green report job can contain a rejected or missing endorsement.

## Publish the static workspace

1. Verify the chosen commit is merged to `main` through review and has passing checks.
2. Keep Pages configured for GitHub Actions and retain existing environment protection rules.
3. Manually run **Publish workspace** on `main`. The workflow publishes only the committed `dist/web/` directory.
4. Read back the deployment URL. Compare HTML, JS, CSS, logo, notices, and font bytes with the release. Check the `/devouch/` base path, navigation, mobile layout, and wallet-free verification.
5. Record the source SHA, workflow URL, deployment URL, checks performed, and any unavailable checks in the release notes. Publication success alone is not proof of successful wallet operations.

Any static HTTPS host can serve `dist/web/`. The local server remains available through `node scripts/serve.ts`; it is not a central Devouch service.

## Rollback

Restore the previously reviewed distribution through a normal PR and republish it manually. Consumers separately restore their reviewed Action SHA and compatible policy. Do not loosen a policy or hide invalid evidence to make a rollback appear successful. Public transactions and withdrawal history are not undone by changing application versions.

See [verification history](history.md) for earlier release evidence. Historical public availability must be checked again for a new release.
