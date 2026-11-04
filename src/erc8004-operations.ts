// ABOUTME: Prepares explicit ERC-8004 registry calls and verifies their exact transaction receipts.
// ABOUTME: Keeps wallet consent, stale-state checks, and publication readback outside recommendation policy.
import { encodeFunctionData, parseEventLogs, sha256, stringToHex, zeroAddress, type Address, type Hex } from 'viem';
import { address, exactKeys, object, strictJson, subject, uint } from './json';
import { EvidenceError, insist } from './errors';
import { Erc8004Reader, feedbackDataURI, identityAbi, MAPPING_KEY, parseFeedbackData, parseFeedbackReference,
  reputationAbi, sameAddress, validHash, type FeedbackReference } from './erc8004';
import { checkDeployment, parseDeployment, type Deployment } from './erc8004-deployment';

export type TransactionPlan = { format: 'devouch-erc8004-plan-v1'; operation: 'register' | 'map' | 'feedback' | 'revoke';
  deployment: Deployment; from: Address; agentId: string | null; subject: string | null; feedbackData: string | null;
  feedbackIndex: string | null; snapshot: { blockNumber: string; blockHash: Hex; timestamp: string };
  transaction: { to: Address; data: Hex; value: '0x0' } };

function transaction(plan: Omit<TransactionPlan, 'transaction'>): TransactionPlan['transaction'] {
  const pin = plan.deployment.registry;
  let to = address(pin.identityRegistry), data: Hex;
  if (plan.operation === 'register') {
    insist(plan.agentId === null && plan.subject === null && plan.feedbackData === null && plan.feedbackIndex === null);
    data = encodeFunctionData({ abi: identityAbi, functionName: 'register' });
  } else {
    const agentId = BigInt(uint(plan.agentId));
    if (plan.operation === 'map') {
      insist(plan.feedbackData === null && plan.feedbackIndex === null);
      data = encodeFunctionData({ abi: identityAbi, functionName: 'setMetadata', args: [agentId, MAPPING_KEY, stringToHex(subject(plan.subject))] });
    } else {
      to = address(pin.reputationRegistry);
      const index = BigInt(uint(plan.feedbackIndex, 64)); insist(index > 0n);
      if (plan.operation === 'feedback') {
        insist(typeof plan.feedbackData === 'string');
        const d = parseFeedbackData(plan.feedbackData); insist(d.subject === plan.subject);
        data = encodeFunctionData({ abi: reputationAbi, functionName: 'giveFeedback', args: [agentId, 1n, 0,
          d.scope, d.format, '', feedbackDataURI(plan.feedbackData), sha256(stringToHex(plan.feedbackData))] });
      } else {
        insist(plan.operation === 'revoke' && plan.subject === null && plan.feedbackData === null);
        data = encodeFunctionData({ abi: reputationAbi, functionName: 'revokeFeedback', args: [agentId, index] });
      }
    }
  }
  return { to, data, value: '0x0' };
}

export function validateTransactionPlan(value: unknown): TransactionPlan {
  const p = object(value);
  exactKeys(p, ['format', 'operation', 'deployment', 'from', 'agentId', 'subject', 'feedbackData', 'feedbackIndex', 'snapshot', 'transaction']);
  insist(p.format === 'devouch-erc8004-plan-v1' && ['register', 'map', 'feedback', 'revoke'].includes(String(p.operation)));
  const deployment = parseDeployment(JSON.stringify(p.deployment)), from = address(p.from);
  const snapshot = object(p.snapshot); exactKeys(snapshot, ['blockNumber', 'blockHash', 'timestamp']);
  uint(snapshot.blockNumber, 64); uint(snapshot.timestamp, 64); insist(validHash(snapshot.blockHash));
  const tx = object(p.transaction); exactKeys(tx, ['to', 'data', 'value']);
  const plan = { ...p, deployment, from } as TransactionPlan;
  const expected = transaction(plan);
  insist(sameAddress(address(tx.to), expected.to) && typeof tx.data === 'string'
    && tx.data.toLowerCase() === expected.data.toLowerCase() && tx.value === '0x0', 'transaction_plan_mismatch');
  return { ...plan, transaction: expected };
}

export async function prepareTransaction(reader: Erc8004Reader, deployment: Deployment,
  input: { operation: TransactionPlan['operation']; from: string; agentId?: string; subject?: string; expiresAt?: string;
    reference?: FeedbackReference }): Promise<TransactionPlan> {
  const d = parseDeployment(JSON.stringify(deployment)), from = address(input.from);
  const block = await reader.client.getBlock({ blockTag: 'latest' });
  insist(block.number !== null && block.hash, 'snapshot_unavailable', 'unavailable');
  await checkDeployment(reader, d, block.number);
  const snapshot = { blockNumber: block.number.toString(), blockHash: block.hash, timestamp: block.timestamp.toString() };
  let agentId: string | null = null, target: string | null = null, feedbackData: string | null = null, feedbackIndex: string | null = null;
  if (input.operation !== 'register') {
    if (input.operation === 'revoke') {
      const r = parseFeedbackReference(JSON.stringify(input.reference));
      insist(r.chainId === d.chainId && sameAddress(r.identityRegistry, d.registry.identityRegistry)
        && sameAddress(r.reputationRegistry, d.registry.reputationRegistry) && sameAddress(r.clientAddress, from), 'reference_mismatch');
      agentId = r.agentId; feedbackIndex = r.feedbackIndex;
    } else {
      agentId = uint(input.agentId); target = subject(input.subject);
      if (input.operation === 'feedback') {
        const owner = await reader.client.readContract({ address: address(d.registry.identityRegistry), abi: identityAbi,
          functionName: 'ownerOf', args: [BigInt(agentId)], blockNumber: block.number });
        feedbackData = JSON.stringify({ format: 'devouch-feedback-v1', subject: target, owner,
          scope: 'oss-contribution', issuedAt: block.timestamp.toString(), expiresAt: uint(input.expiresAt, 64) });
        parseFeedbackData(feedbackData);
        feedbackIndex = ((await reader.client.readContract({ address: address(d.registry.reputationRegistry), abi: reputationAbi,
          functionName: 'getLastIndex', args: [BigInt(agentId), from], blockNumber: block.number })) + 1n).toString();
      }
    }
  }
  const base = { format: 'devouch-erc8004-plan-v1' as const, operation: input.operation, deployment: d,
    from, agentId, subject: target, feedbackData, feedbackIndex, snapshot };
  const plan = validateTransactionPlan({ ...base, transaction: transaction(base) });
  await validateCurrentPlan(reader, plan);
  return plan;
}

export async function validateCurrentPlan(reader: Erc8004Reader, input: TransactionPlan) {
  const plan = validateTransactionPlan(input), client = reader.client, d = plan.deployment;
  const block = await client.getBlock({ blockTag: 'latest' });
  insist(block.number !== null && block.hash, 'snapshot_unavailable', 'unavailable');
  await checkDeployment(reader, d, block.number);
  const prepared = await client.getBlock({ blockNumber: BigInt(plan.snapshot.blockNumber) });
  insist(prepared.hash === plan.snapshot.blockHash && prepared.timestamp.toString() === plan.snapshot.timestamp,
    'snapshot_changed', 'unavailable');
  insist(block.timestamp >= prepared.timestamp && block.timestamp - prepared.timestamp <= 900n, 'request_stale');
  const identity = address(d.registry.identityRegistry), reputation = address(d.registry.reputationRegistry);
  if (plan.operation === 'map') {
    const owner = await client.readContract({ address: identity, abi: identityAbi, functionName: 'ownerOf',
      args: [BigInt(plan.agentId!)], blockNumber: block.number });
    insist(sameAddress(owner, plan.from), 'owner_required');
  } else if (plan.operation === 'feedback') {
    const data = parseFeedbackData(plan.feedbackData!), id = BigInt(plan.agentId!);
    insist(block.timestamp < BigInt(data.expiresAt), 'feedback_expired', 'expired');
    const [owner, mapping, authorized, last] = await Promise.all([
      client.readContract({ address: identity, abi: identityAbi, functionName: 'ownerOf', args: [id], blockNumber: block.number }),
      client.readContract({ address: identity, abi: identityAbi, functionName: 'getMetadata', args: [id, MAPPING_KEY], blockNumber: block.number }),
      client.readContract({ address: identity, abi: identityAbi, functionName: 'isAuthorizedOrOwner', args: [plan.from, id], blockNumber: block.number }),
      client.readContract({ address: reputation, abi: reputationAbi, functionName: 'getLastIndex', args: [id, plan.from], blockNumber: block.number }),
    ]);
    insist(sameAddress(owner, data.owner), 'owner_changed');
    insist(mapping.toLowerCase() === stringToHex(data.subject).toLowerCase(), 'github_mapping_mismatch');
    insist(!authorized, 'issuer_is_owner_or_operator');
    insist(last + 1n === BigInt(plan.feedbackIndex!), 'feedback_index_changed');
  } else if (plan.operation === 'revoke') {
    const current = await client.readContract({ address: reputation, abi: reputationAbi, functionName: 'readFeedback',
      args: [BigInt(plan.agentId!), plan.from, BigInt(plan.feedbackIndex!)], blockNumber: block.number });
    insist(!current[4], 'feedback_revoked', 'revoked');
  }
  try { await client.call({ account: plan.from, to: plan.transaction.to, data: plan.transaction.data, blockNumber: block.number }); }
  catch { throw new EvidenceError('transaction_simulation_failed'); }
  return plan;
}

export async function confirmTransaction(reader: Erc8004Reader, input: TransactionPlan, hash: Hex,
  submittedHash: Hex | null = null) {
  const plan = validateTransactionPlan(input); insist(validHash(hash), 'invalid_transaction_hash');
  const client = reader.client;
  insist(await client.getChainId() === plan.deployment.chainId, 'wrong_chain', 'unavailable');
  const [receipt, tx] = await Promise.all([client.getTransactionReceipt({ hash }), client.getTransaction({ hash })]);
  insist(sameAddress(tx.from, plan.from) && tx.value === 0n, 'transaction_mismatch');
  const exactCall = tx.to && sameAddress(tx.to, plan.transaction.to)
    && tx.input.toLowerCase() === plan.transaction.data.toLowerCase();
  // Wallets may wrap a call. Their recorded hash can prove failure, but never prove a successful operation.
  const submittedRevert = receipt.status === 'reverted' && submittedHash !== null
    && validHash(submittedHash) && submittedHash.toLowerCase() === hash.toLowerCase();
  insist(exactCall || submittedRevert, 'transaction_mismatch');
  insist(receipt.blockNumber > BigInt(plan.snapshot.blockNumber)
    && receipt.transactionHash.toLowerCase() === hash.toLowerCase() && tx.hash.toLowerCase() === hash.toLowerCase()
    && tx.blockNumber === receipt.blockNumber && tx.blockHash === receipt.blockHash, 'transaction_mismatch');
  const observed = await client.getBlock({ blockNumber: receipt.blockNumber });
  insist(observed.hash === receipt.blockHash, 'snapshot_changed', 'unavailable');
  if (receipt.status === 'reverted') return { status: 'reverted' as const, hash };
  await checkDeployment(reader, plan.deployment, receipt.blockNumber);
  const identity = address(plan.deployment.registry.identityRegistry), reputation = address(plan.deployment.registry.reputationRegistry);
  if (plan.operation === 'register') {
    const event = parseEventLogs({ abi: identityAbi, eventName: 'Transfer', logs: receipt.logs }).find(log =>
      sameAddress(log.address, identity) && log.args.from === zeroAddress && sameAddress(log.args.to, plan.from));
    insist(event, 'registration_readback_mismatch');
    const owner = await client.readContract({ address: identity, abi: identityAbi, functionName: 'ownerOf',
      args: [event.args.tokenId], blockNumber: receipt.blockNumber });
    insist(sameAddress(owner, plan.from), 'registration_readback_mismatch');
    return { status: 'confirmed' as const, hash, agentId: event.args.tokenId.toString() };
  }
  if (plan.operation === 'map') {
    const value = await client.readContract({ address: identity, abi: identityAbi, functionName: 'getMetadata',
      args: [BigInt(plan.agentId!), MAPPING_KEY], blockNumber: receipt.blockNumber });
    insist(value.toLowerCase() === stringToHex(plan.subject!).toLowerCase(), 'mapping_readback_mismatch');
  } else if (plan.operation === 'feedback') {
    const event = parseEventLogs({ abi: reputationAbi, eventName: 'NewFeedback', logs: receipt.logs }).find(log =>
      sameAddress(log.address, reputation) && log.args.agentId === BigInt(plan.agentId!) && sameAddress(log.args.clientAddress, plan.from)
      && log.args.feedbackIndex === BigInt(plan.feedbackIndex!));
    insist(event && event.args.feedbackHash === sha256(stringToHex(plan.feedbackData!)), 'feedback_readback_mismatch');
    const reference: FeedbackReference = { format: 'devouch-erc8004-v1', chainId: plan.deployment.chainId,
      identityRegistry: identity, reputationRegistry: reputation, agentId: plan.agentId!, clientAddress: plan.from,
      feedbackIndex: plan.feedbackIndex!, feedbackBlock: receipt.blockNumber.toString() };
    const evidence = await reader.inspect(reference, plan.subject!, receipt.blockNumber);
    insist(evidence.evidence_status === 'valid', 'feedback_readback_mismatch');
    return { status: 'confirmed' as const, hash, reference };
  } else {
    const result = await client.readContract({ address: reputation, abi: reputationAbi, functionName: 'readFeedback',
      args: [BigInt(plan.agentId!), plan.from, BigInt(plan.feedbackIndex!)], blockNumber: receipt.blockNumber });
    insist(result[4], 'revocation_readback_mismatch');
  }
  return { status: 'confirmed' as const, hash };
}
