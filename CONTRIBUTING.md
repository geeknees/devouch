# Contributing

Devouch separates evidence validity from each repository's acceptance policy. Changes should preserve that distinction and keep human review with maintainers. Start with [the documentation index](docs/README.md) and [design principles](docs/design.md).

For an architectural change, describe the problem and trade-offs in an issue before implementing it. Bug reports are most useful with the Devouch version, command or screen, sanitized reason codes, and steps to reproduce. Never include wallet keys, tokens, credential-bearing RPC URLs, or private logs.

## Local development

Use Ruby 3.4+, Node.js 24, Bun 1.3.13, Bundler, and Chrome/Chromium. Runtimes can be managed with mise. The checked-in `dist/` supports the CLI without installing JavaScript dependencies; source development needs the dependencies below.

```sh
bundle install
bun install --frozen-lockfile
bundle exec rake test
bundle exec rake lint
bun test test/ts
bun run typecheck
bun run test:integration
git diff --exit-code -- dist/
```

The integration runner builds the distribution and runs each test file in a separate Bun process and disposable local EVM. It sends no public-chain transactions. On macOS it uses installed Google Chrome; on Linux run `bunx playwright install --with-deps chromium`. See [workspace usage](docs/usage.md#workspace) for local serving.

For source changes, add or update behavior tests and run the affected suite. For documentation changes, check relative links and commands. Regenerate `dist/` when its inputs change and include the generated changes in the same PR; the final diff check above should be clean after committing that build.

## Pull requests

- Explain the problem, resulting behavior, and verification. Separate local tests from public RPC, wallet, hosted CI, and deployment results.
- Keep unrelated changes out of the diff. Do not add local runtime state, generated recordings, or secrets.
- Use a descriptive conventional commit message, for example `fix: reject a mismatched contributor identity`.
- Preserve third-party licenses and pinned artifact provenance. Contract updates need explicit source versions and compatibility evidence.

The read-only Devouch report is input to review. An accepted endorsement is not code approval or permission to merge. Follow the repository's contribution rules and maintainer review.

## Releases

Maintainers follow the [release runbook](docs/release-runbook.md). Publishing an Action version and deploying the static workspace are separate operations. Historical checks are recorded in [verification history](docs/history.md); they are not evidence that today's public state is unchanged.
