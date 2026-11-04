# Wallet gas preflight and remaining smart-account work

Devouch now estimates and simulates the direct registry call before wallet submission, with a rounded-up 25% gas margin. It stops on unavailable estimates and preserves the existing pending-operation and receipt checks. This change does **not** establish successful registration through MetaMask's transaction wrapper. The gas work remains a draft until that path and its confirmation can be verified.

## Observed failure

A Sepolia registration failed inside the Identity Registry implementation with `out of gas`. The outer receipt used 485,720 of its 794,838 gas limit. That remaining outer gas did not establish that the nested registry call had enough gas.

Read-only replays at the parent block, including the original type-4 authorization list, nonce, calldata, and fee fields, produced:

| Gas limit | Replay result |
| --- | --- |
| 794,838 | The nested registration ran out of gas, matching the failed transaction. |
| 1,100,000 | The replay succeeded; total simulated gas used was 632,094. |

These numbers describe this transaction and historical state. They are not universal gas limits or proof of another wallet submission. Replaying at the block after the failure without the authorization context was misleading: the account delegation already existed and the original limit also succeeded. An EIP-7702 delegation can remain after the execution reverts.

## Why an application gas override is insufficient

MetaMask's [transaction-container implementation](https://github.com/MetaMask/metamask-extension/blob/82ff52fd89e8c25776c2e35a430ac8573719d45f/app/scripts/lib/transaction/containers/util.ts) removes `gas` and `gasLimit` from the estimation input, estimates the transformed transaction, and can replace both fields during approval. Its [enforced-simulation wrapper](https://github.com/MetaMask/metamask-extension/blob/82ff52fd89e8c25776c2e35a430ac8573719d45f/app/scripts/lib/transaction/containers/enforced-simulations.ts) changes the destination and calldata and may add an account authorization. This source inspection is pinned; the affected installed extension version has not been recorded.

Devouch's direct-call margin therefore cannot guarantee gas for that wrapper. It also does not make the existing success verifier accept a changed call. The saved-hash exception in recovery proves a canonical failure only. No protection setting should be disabled as part of this validation.

## Read-only reproduction

Use an archive/debug-capable RPC for the transaction's network and a mined transaction hash:

```sh
bun scripts/replay-wallet-gas.ts https://rpc.sepolia.ethpandaops.io MINED_TX_HASH 1100000
```

The script traces the original limit and each supplied alternative. It issues only `eth_getTransactionByHash` and `debug_traceCall`, preserves the authorization and fee fields, and uses the parent block. Output includes nested failures, gas, and `transactionSent: false`, without account addresses or full calldata. It never signs or broadcasts. Parent-block replay does not include earlier transactions from the same block or guarantee identical block-header conditions; compare it with the actual receipt and transaction trace.

## Validation still required

- Record the affected MetaMask version and verify how its final approval path handles the gas limit, including initial account delegation.
- Resolve the wrapped-transaction gas estimate and verify an explicitly approved registration with the real wallet.
- Implement and test exact successful-wrapper confirmation before presenting that wallet path as supported.
- Resolve any outstanding site or transaction warning independently before approving another public transaction.

Local EVM, mocked wallet, and browser checks cover direct calls and preflight failures. They do not establish those remaining real-wallet results.
