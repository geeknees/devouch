// ABOUTME: Sends only reviewed zero-value registry calls through the user's connected wallet.
// ABOUTME: Verifies successful calls exactly and clears failed wrappers only through their recorded wallet hash.
import { toHex, type EIP1193Provider, type Hex } from 'viem';
import { address } from '../src/json';
import { EvidenceError, insist } from '../src/errors';
import { Erc8004Reader, sameAddress } from '../src/erc8004';
import { confirmTransaction, validateCurrentPlan, validateTransactionPlan, type TransactionPlan } from '../src/erc8004-operations';
import { Submission } from './submission';

function gasQuantity(value: unknown, reason: string): bigint {
  insist(typeof value === 'string' && /^0x[1-9a-fA-F][0-9a-fA-F]{0,63}(?![\s\S])/.test(value), reason, 'unavailable');
  return BigInt(value);
}

export class WalletSession {
  account: string | null = null;
  constructor(readonly provider: EIP1193Provider, readonly reader: Erc8004Reader, readonly submission: Submission) {}
  async connect() {
    const accounts = await this.provider.request({ method: 'eth_requestAccounts' });
    this.account = address(accounts[0]); return this.account;
  }
  async send(plan: TransactionPlan) {
    insist(!this.submission.pending, 'pending_transaction');
    plan = validateTransactionPlan(plan);
    const accounts = await this.provider.request({ method: 'eth_accounts' });
    insist(this.account && sameAddress(address(accounts[0]), this.account) && sameAddress(this.account, plan.from), 'wallet_changed');
    const chainId = await this.provider.request({ method: 'eth_chainId' });
    insist(BigInt(chainId) === BigInt(plan.deployment.chainId), 'wrong_chain');
    const transaction = { from: plan.from, ...plan.transaction, chainId: toHex(plan.deployment.chainId) };
    let estimate: unknown;
    try { estimate = await this.provider.request({ method: 'eth_estimateGas', params: [transaction] }); }
    catch { throw new EvidenceError('gas_estimation_failed', 'unavailable'); }
    const estimated = gasQuantity(estimate, 'gas_estimate_invalid');
    insist(estimated >= 21_000n, 'gas_estimate_invalid', 'unavailable');
    let block;
    try { block = await this.provider.request({ method: 'eth_getBlockByNumber', params: ['latest', false] }); }
    catch { throw new EvidenceError('gas_block_unavailable', 'unavailable'); }
    const blockGas = gasQuantity(block?.gasLimit, 'gas_block_unavailable');
    // This margin covers the direct call only. A wallet can wrap it and replace the gas limit.
    const buffered = (estimated * 5n + 3n) / 4n;
    insist(buffered <= blockGas, 'gas_limit_exceeds_block', 'unavailable');
    const request = { ...transaction, gas: toHex(buffered) };
    try { await this.provider.request({ method: 'eth_call', params: [request, 'latest'] }); }
    catch { throw new EvidenceError('gas_simulation_failed', 'unavailable'); }
    // Recheck current state and expiry after the asynchronous wallet preflight.
    await validateCurrentPlan(this.reader, plan);
    const currentAccounts = await this.provider.request({ method: 'eth_accounts' });
    const currentChain = await this.provider.request({ method: 'eth_chainId' });
    insist(sameAddress(address(currentAccounts[0]), plan.from), 'wallet_changed');
    insist(BigInt(currentChain) === BigInt(plan.deployment.chainId), 'wrong_chain');
    return this.submission.send(plan, () => this.provider.request({ method: 'eth_sendTransaction', params: [request] }));
  }
  async recover(hash: Hex) {
    const pending = this.submission.pending; insist(pending, 'pending_transaction_missing');
    const result = await confirmTransaction(this.reader, pending.plan, hash, pending.hash);
    this.submission.complete(); return result;
  }
}
