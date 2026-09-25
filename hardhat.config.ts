// ABOUTME: Configures an isolated EVM for testing the official ENSv2 bytecode.
// ABOUTME: Uses Sepolia's chain ID locally without sending public-chain transactions.
import { defineConfig } from 'hardhat/config';
export default defineConfig({ networks: { node: { type: 'edr-simulated', chainId: 11155111, hardfork: 'cancun', allowBlocksWithSameTimestamp: true } } });
