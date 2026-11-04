// ABOUTME: Sends only reviewed zero-value registry calls through the user's connected wallet.
// ABOUTME: Verifies chain, account, calldata, receipt, and readback before clearing a pending operation.
import { toHex, type EIP1193Provider, type Hex } from 'viem';
import { address } from '../src/json';
import { insist } from '../src/errors';
import { Erc8004Reader, sameAddress } from '../src/erc8004';
import { confirmTransaction, validateCurrentPlan, type TransactionPlan } from '../src/erc8004-operations';
import { Submission } from './submission';
export class WalletSession {
  account: string | null = null;
  constructor(readonly provider: EIP1193Provider, readonly reader: Erc8004Reader, readonly submission: Submission) {}
  async connect() {
    const accounts = await this.provider.request({ method: 'eth_requestAccounts' });
    this.account = address(accounts[0]); return this.account;
  }
  async send(plan: TransactionPlan) {
    insist(!this.submission.pending, 'pending_transaction');
    const accounts = await this.provider.request({ method: 'eth_accounts' });
    insist(this.account && sameAddress(address(accounts[0]), this.account) && sameAddress(this.account, plan.from), 'wallet_changed');
    const chainId = await this.provider.request({ method: 'eth_chainId' });
    insist(BigInt(chainId) === BigInt(plan.deployment.chainId), 'wrong_chain');
    await validateCurrentPlan(this.reader, plan);
    const currentAccounts = await this.provider.request({ method: 'eth_accounts' });
    const currentChain = await this.provider.request({ method: 'eth_chainId' });
    insist(sameAddress(address(currentAccounts[0]), plan.from), 'wallet_changed');
    insist(BigInt(currentChain) === BigInt(plan.deployment.chainId), 'wrong_chain');
    return this.submission.send(plan, () => this.provider.request({ method: 'eth_sendTransaction', params: [{
      from: plan.from, to: plan.transaction.to, data: plan.transaction.data, value: '0x0', chainId: toHex(plan.deployment.chainId),
    }] }));
  }
  async recover(hash: Hex) {
    const pending = this.submission.pending; insist(pending, 'pending_transaction_missing');
    const result = await confirmTransaction(this.reader, pending.plan, hash);
    this.submission.complete(); return result;
  }
}
