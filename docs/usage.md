# Usage

This checkout is the ERC-8004 version of Devouch. For ENS installations, start with [the migration guide](upgrading-0.3.md). The hosted workspace changes only after a separate reviewed Pages deployment; a merged PR does not publish it.

## Workspace

Run `bun run build` and `node scripts/serve.ts`, then open the printed loopback URL. The workspace uses the pinned Sepolia deployment in [configuration](../config/erc8004-sepolia.json). RPC reads begin when you choose an operation; connecting a wallet is only necessary for preparation and submission.

1. **Agent controller:** use **Register & map** to register an agent. Review and submit with the owning wallet, then use **Check transaction** to read the receipt and exact state. The confirmed agent ID is shown. Declare the intended GitHub numeric ID for that agent in a separate reviewed operation.
2. **Independent evaluator:** connect a different wallet, open **Recommend**, enter that agent ID, GitHub numeric ID, and expiry. The owner and approved operators cannot give feedback to their own agent. Preparation does not send anything.
3. Review the operation, wallet, chain, registry, account declaration, scope, and expiry. Check consent and **Submit with wallet**. There is no ETH value transfer, but network gas costs apply.
4. **Check transaction** verifies the transaction sender, destination, calldata, receipt, and registry state. For feedback, download the confirmed reference and give it to the contributor. Mined receipt verification is distinct from finalized evidence verification.
5. In **Verify**, enter a public GitHub PR URL, or load a reference and receiving policy with the subject ID. The PR flow derives the subject from the actual author and reads policy at the base SHA.
6. To withdraw feedback, load its reference in **Withdraw**, review, submit as its evaluator, and check the transaction. Earlier GitHub checks must be rerun.

The controller's GitHub declaration and evaluator's recommendation do not prove GitHub account ownership. Agent transfer, approval changes, mapping changes, and registry upgrades require new feedback under this conservative profile, even if the old state is restored.

## Recovery

Pending operations are saved locally before wallet submission. A lost response can mean the transaction was sent. Reloading does not permit a duplicate. Check wallet history, enter the exact hash, and check the transaction. A rejected wallet request clears its pending record; an unknown outcome does not. Save the public recovery JSON when moving between browsers. Recovery requires the matching network's RPC, but no wallet connection.

An imported unsigned plan is checked against its reconstructed registry calldata and current chain state before sending. Plans expire after 15 minutes. Unknown or mismatched receipts remain pending. Preserve unreadable recovery storage and recover from a valid exported file in another browser rather than blindly resending. Local files, references, and recovery data contain only public information; never import keys or recovery phrases.

## CLI

Use Ruby 3.4+ and Node.js 24. The committed bundle supports CLI use without a JavaScript dependency install. Replace sample IDs, addresses, expiry, and paths with actual values. Output files must not already exist.

```sh
./exe/devouch --help
./exe/devouch register --owner 0xYOUR_PUBLIC_ADDRESS --output register.json --json
./exe/devouch map --owner 0xYOUR_PUBLIC_ADDRESS --agent-id 42 \
  --subject github:12345 --output map.json --json
./exe/devouch request --issuer 0xEVALUATOR_PUBLIC_ADDRESS --agent-id 42 \
  --subject github:12345 --expires-at 2027-01-01T00:00:00Z --output request.json --json
```

These commands prepare unsent plans. Load each in **Network and files → Load an unsigned CLI operation**, then review and submit with the corresponding wallet. Obtain real registry IDs from confirmed registration, and a real feedback locator from the confirmed publication.

```sh
./exe/devouch fetch --agent-id 42 --issuer 0xEVALUATOR_PUBLIC_ADDRESS \
  --feedback-index 1 --feedback-block 12000000 --output feedback.json --json
./exe/devouch verify --credential feedback.json --policy .devouch/erc8004-policy.json \
  --subject github:12345 --json
./exe/devouch check --repo OWNER/REPOSITORY --credential feedback.json \
  --subject github:12345 --json
./exe/devouch revoke --credential feedback.json --output revoke.json --json
```

`fetch` retrieves a reference and checks the event's committed data; it does not establish current validity. `check` obtains the destination's policy at an immutable base commit and never submits a PR. `verify` uses a supplied local policy. `--credential` now names an ERC-8004 reference, not an ENS signed JSON. For an explicitly reviewed alternate deployment, preparation and retrieval support `--deployment PATH`; verification reads the reference's registry and the receiving policy's pins.

See [the CLI reference](cli-interface.md) for options and exit codes, and [the protocol](protocol.md) for limits.
