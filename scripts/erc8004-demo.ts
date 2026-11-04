// ABOUTME: Reports one local feedback under two independently controlled repository policies.
// ABOUTME: Exposes fixed source versions and observed block data without any account credentials.
import { evaluateErc8004Policy } from '../src/erc8004-policy';
import { setupErc8004 } from '../test/support/erc8004';
import manifest from '../vendor/erc-8004/manifest.json';
const f = await setupErc8004();
const evidence = await f.reader.inspect(f.reference, f.subject, await f.observe());
const decisions = { 'example/a': evaluateErc8004Policy(f.policy, evidence),
  'example/b': evaluateErc8004Policy({ ...f.policy, repositoryId: 'example/b', trustedIssuers: [] }, evidence) };
console.log(JSON.stringify({ environment: 'disposable_local_evm', implementationCommit: manifest.implementationCommit,
  specificationCommit: manifest.specificationCommit, reference: f.reference, policy: f.policy, evidence, decisions }, null, 2));
if (evidence.evidence_status !== 'valid' || decisions['example/a'].policy_status !== 'accepted' ||
  decisions['example/b'].policy_status !== 'rejected') process.exitCode = 1;
