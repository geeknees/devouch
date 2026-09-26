// ABOUTME: Builds repository trust policy from records explicitly selected by a maintainer.
// ABOUTME: Emits a read-only, commit-pinned Action workflow without executing contributor code.
import { insist } from './errors';
import { parsePolicy, type PolicyEvidence } from './policy';

export function buildOnboarding(repositoryId: string, actionSha: string, selected: PolicyEvidence[]) {
  insist(actionSha.length === 40 && /^[a-f0-9]{40}$/.test(actionSha), 'invalid_action_sha');
  insist(selected.length > 0 && selected.length <= 64, 'trust_selection_required');
  insist(selected.every(value => value.evidence_status === 'valid'), 'evidence_not_valid');
  const issuers = new Map<string, string>(), resolvers = new Map<string, { address: string; implementation: string }>();
  for (const value of selected) {
    insist(value.issuer && value.resolver && value.implementation && value.scope, 'invalid_policy');
    issuers.set(value.issuer.toLowerCase(), value.issuer);
    resolvers.set(`${value.resolver.toLowerCase()}:${value.implementation.toLowerCase()}`,
      { address: value.resolver, implementation: value.implementation });
  }
  const policy = parsePolicy(JSON.stringify({ repositoryId, chainId: 11155111, trustedIssuers: [...issuers.values()],
    allowedScopes: [...new Set(selected.map(value => value.scope))], allowedResolvers: [...resolvers.values()], requiredIssuers: 1 }));
  const githubToken = '${{ github.token }}';
  const workflow = `# ABOUTME: Reports the pull request author's portable endorsement.
# ABOUTME: Reads JSON and chain state without executing pull request code.
name: Devouch

on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]

permissions:
  contents: read
  pull-requests: read

jobs:
  endorsement:
    name: Devouch endorsement report
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: geeknees/devouch@${actionSha}
        with:
          policy-path: .devouch/policy.json
          mode: report
          github-token: ${githubToken}
`;
  return { policy, workflow };
}
