/**
 * Blockchain Fetcher Router
 *
 * Dispatches to the correct fetcher based on chain type.
 * Handles parallel fetching for multiple chains with rate limiting.
 */

import type { RawTx } from "../types";
import { fetchEthereumTransactions } from "./ethereum";
import { fetchBitcoinTransactions } from "./bitcoin";
import { fetchSolanaTransactions } from "./solana";

export type FetchResult = {
  txs: RawTx[];
  tokens: Set<string>; // Unique token addresses found
  errors: string[];
};

type ChainFetcher = (
  address: string,
  startDate: string,
  endDate: string
) => Promise<FetchResult>;

const CHAIN_FETCHERS: Record<string, ChainFetcher> = {
  Ethereum: (addr, start, end) => fetchEthereumTransactions(addr, "ethereum", start, end),
  Polygon: (addr, start, end) => fetchEthereumTransactions(addr, "polygon", start, end),
  Arbitrum: (addr, start, end) => fetchEthereumTransactions(addr, "arbitrum", start, end),
  Base: (addr, start, end) => fetchEthereumTransactions(addr, "base", start, end),
  Optimism: (addr, start, end) => fetchEthereumTransactions(addr, "optimism", start, end),
  Bitcoin: fetchBitcoinTransactions,
  Solana: fetchSolanaTransactions,
};

// Chains that use Alchemy (EVM)
const EVM_CHAINS = ["Ethereum", "Polygon", "Arbitrum", "Base", "Optimism"];

/**
 * Fetch transactions for a wallet across multiple chains
 */
export async function fetchWalletTransactions(
  address: string,
  chains: string[],
  year: number
): Promise<FetchResult> {
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  const results: FetchResult = {
    txs: [],
    tokens: new Set(),
    errors: [],
  };

  // Group EVM chains together for rate limiting
  const evmChains = chains.filter((c) => EVM_CHAINS.includes(c));
  const otherChains = chains.filter((c) => !EVM_CHAINS.includes(c));

  // Fetch EVM chains sequentially (share rate limit)
  for (const chain of evmChains) {
    const fetcher = CHAIN_FETCHERS[chain];
    if (!fetcher) {
      results.errors.push(`No fetcher for chain: ${chain}`);
      continue;
    }

    try {
      const result = await fetcher(address, startDate, endDate);
      results.txs.push(...result.txs);
      result.tokens.forEach((t) => results.tokens.add(t));
      if (result.errors.length > 0) {
        results.errors.push(...result.errors);
      }
    } catch (err) {
      results.errors.push(`${chain}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    // Small delay between EVM chains to avoid rate limits
    if (evmChains.indexOf(chain) < evmChains.length - 1) {
      await sleep(100);
    }
  }

  // Fetch other chains in parallel
  const otherPromises = otherChains.map(async (chain) => {
    const fetcher = CHAIN_FETCHERS[chain];
    if (!fetcher) {
      return { txs: [], tokens: new Set<string>(), errors: [`No fetcher for chain: ${chain}`] };
    }

    try {
      return await fetcher(address, startDate, endDate);
    } catch (err) {
      return {
        txs: [],
        tokens: new Set<string>(),
        errors: [`${chain}: ${err instanceof Error ? err.message : "Unknown error"}`],
      };
    }
  });

  const otherResults = await Promise.all(otherPromises);
  for (const result of otherResults) {
    results.txs.push(...result.txs);
    result.tokens.forEach((t) => results.tokens.add(t));
    results.errors.push(...result.errors);
  }

  // Sort all transactions by timestamp
  results.txs.sort((a, b) => a.timestamp - b.timestamp);

  return results;
}

/**
 * Detect which chains a wallet address belongs to
 */
export function detectWalletChains(address: string): string[] {
  const a = address.trim();

  // EVM address
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) {
    return ["Ethereum"]; // Default to Ethereum, user can add more
  }

  // Bitcoin
  if (/^bc1[a-z0-9]{25,87}$/.test(a) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a)) {
    return ["Bitcoin"];
  }

  // Solana
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) {
    return ["Solana"];
  }

  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { fetchEthereumTransactions } from "./ethereum";
export { fetchBitcoinTransactions } from "./bitcoin";
export { fetchSolanaTransactions } from "./solana";
