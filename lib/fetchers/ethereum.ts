/**
 * Ethereum & EVM Chain Fetcher (via Alchemy)
 *
 * Uses alchemy_getAssetTransfers API for efficient transaction fetching.
 * Supports: Ethereum, Polygon, Arbitrum, Base, Optimism
 */

import type { RawTx } from "../types";
import type { FetchResult } from "./index";

// Alchemy API base URLs by network
const ALCHEMY_URLS: Record<string, string> = {
  ethereum: "https://eth-mainnet.g.alchemy.com/v2/",
  polygon: "https://polygon-mainnet.g.alchemy.com/v2/",
  arbitrum: "https://arb-mainnet.g.alchemy.com/v2/",
  base: "https://base-mainnet.g.alchemy.com/v2/",
  optimism: "https://opt-mainnet.g.alchemy.com/v2/",
};

// Chain names for output
const CHAIN_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  base: "Base",
  optimism: "Optimism",
};

// Native token info by chain
const NATIVE_TOKENS: Record<string, { symbol: string; address: string }> = {
  ethereum: { symbol: "ETH", address: "0x0000000000000000000000000000000000000000" },
  polygon: { symbol: "MATIC", address: "0x0000000000000000000000000000000000000000" },
  arbitrum: { symbol: "ETH", address: "0x0000000000000000000000000000000000000000" },
  base: { symbol: "ETH", address: "0x0000000000000000000000000000000000000000" },
  optimism: { symbol: "ETH", address: "0x0000000000000000000000000000000000000000" },
};

type AlchemyTransfer = {
  blockNum: string;
  hash: string;
  from: string;
  to: string;
  value: number | null;
  asset: string | null;
  category: "external" | "internal" | "erc20" | "erc721" | "erc1155" | "specialnft";
  rawContract: {
    address: string | null;
    value: string | null;
    decimal: string | null;
  };
  metadata: {
    blockTimestamp: string;
  };
};

type AlchemyResponse = {
  result: {
    transfers: AlchemyTransfer[];
    pageKey?: string;
  };
};

export async function fetchEthereumTransactions(
  address: string,
  network: string,
  startDate: string,
  endDate: string
): Promise<FetchResult> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    return {
      txs: [],
      tokens: new Set(),
      errors: ["ALCHEMY_API_KEY not configured"],
    };
  }

  const baseUrl = ALCHEMY_URLS[network];
  if (!baseUrl) {
    return {
      txs: [],
      tokens: new Set(),
      errors: [`Unknown network: ${network}`],
    };
  }

  const url = `${baseUrl}${apiKey}`;
  const chainName = CHAIN_NAMES[network];
  const nativeToken = NATIVE_TOKENS[network];

  const txs: RawTx[] = [];
  const tokens = new Set<string>();
  const errors: string[] = [];

  // Convert dates to block timestamps for filtering
  const startTs = new Date(startDate).getTime() / 1000;
  const endTs = new Date(endDate).getTime() / 1000;

  // Estimate block numbers for date range (Ethereum ~12 sec/block)
  // This helps avoid fetching all historical transactions
  const currentBlock = await getCurrentBlockNumber(url);
  const secondsPerBlock = 12;
  const now = Date.now() / 1000;
  const blocksFromStart = Math.floor((now - startTs) / secondsPerBlock);
  const blocksFromEnd = Math.floor((now - endTs) / secondsPerBlock);
  const fromBlock = Math.max(0, currentBlock - blocksFromStart);
  const toBlock = Math.max(0, currentBlock - blocksFromEnd);

  try {
    // Fetch incoming transfers with block range
    const incomingTxs = await fetchAssetTransfers(url, {
      toAddress: address,
      category: ["external", "internal", "erc20"],
      withMetadata: true,
      maxCount: "0x3e8", // 1000
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
    });

    // Fetch outgoing transfers with block range
    const outgoingTxs = await fetchAssetTransfers(url, {
      fromAddress: address,
      category: ["external", "internal", "erc20"],
      withMetadata: true,
      maxCount: "0x3e8",
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
    });

    // Process incoming
    for (const tx of incomingTxs) {
      const timestamp = new Date(tx.metadata.blockTimestamp).getTime() / 1000;
      if (timestamp < startTs || timestamp >= endTs) continue;

      const tokenAddress = tx.rawContract.address?.toLowerCase() ?? nativeToken.address;
      const symbol = tx.asset ?? nativeToken.symbol;
      const amount = tx.value ?? 0;

      if (amount <= 0) continue;

      tokens.add(tokenAddress);

      txs.push({
        hash: tx.hash,
        blockNumber: parseInt(tx.blockNum, 16),
        timestamp,
        from: tx.from.toLowerCase(),
        to: tx.to?.toLowerCase() ?? address.toLowerCase(),
        token: symbol,
        tokenAddress,
        amount,
        direction: "in",
        chain: chainName,
        type: classifyTransaction(tx, address, "in"),
      });
    }

    // Process outgoing
    for (const tx of outgoingTxs) {
      const timestamp = new Date(tx.metadata.blockTimestamp).getTime() / 1000;
      if (timestamp < startTs || timestamp >= endTs) continue;

      const tokenAddress = tx.rawContract.address?.toLowerCase() ?? nativeToken.address;
      const symbol = tx.asset ?? nativeToken.symbol;
      const amount = tx.value ?? 0;

      if (amount <= 0) continue;

      tokens.add(tokenAddress);

      txs.push({
        hash: tx.hash,
        blockNumber: parseInt(tx.blockNum, 16),
        timestamp,
        from: tx.from.toLowerCase(),
        to: tx.to?.toLowerCase() ?? "",
        token: symbol,
        tokenAddress,
        amount,
        direction: "out",
        chain: chainName,
        type: classifyTransaction(tx, address, "out"),
      });
    }

    // Deduplicate by hash + token + direction
    const seen = new Set<string>();
    const deduped = txs.filter((tx) => {
      const key = `${tx.hash}-${tx.tokenAddress}-${tx.direction}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      txs: deduped,
      tokens,
      errors,
    };
  } catch (err) {
    errors.push(`Alchemy ${network}: ${err instanceof Error ? err.message : "Unknown error"}`);
    return { txs: [], tokens, errors };
  }
}

async function getCurrentBlockNumber(url: string): Promise<number> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_blockNumber",
      params: [],
    }),
  });
  const data = await response.json() as { result: string };
  return parseInt(data.result, 16);
}

async function fetchAssetTransfers(
  url: string,
  params: {
    fromAddress?: string;
    toAddress?: string;
    category: string[];
    withMetadata: boolean;
    maxCount: string;
    fromBlock?: string;
    toBlock?: string;
    pageKey?: string;
  }
): Promise<AlchemyTransfer[]> {
  const allTransfers: AlchemyTransfer[] = [];
  let pageKey: string | undefined;

  do {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            ...params,
            ...(pageKey ? { pageKey } : {}),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status}`);
    }

    const data = (await response.json()) as AlchemyResponse;

    if (data.result?.transfers) {
      allTransfers.push(...data.result.transfers);
    }

    pageKey = data.result?.pageKey;

    // Rate limiting: wait between pages
    if (pageKey) {
      await new Promise((r) => setTimeout(r, 200));
    }
  } while (pageKey && allTransfers.length < 5000); // Cap at 5000 txs

  return allTransfers;
}

function classifyTransaction(
  tx: AlchemyTransfer,
  _walletAddress: string,
  direction: "in" | "out"
): RawTx["type"] {
  // Basic classification based on category and patterns
  if (tx.category === "internal") {
    return "swap"; // Internal txs are often from contract interactions
  }

  if (direction === "in") {
    // Check for common airdrop patterns (many recipients, small amounts)
    // This is a simplification - real detection would need more context
    if (tx.asset && tx.value && tx.value < 100) {
      return "airdrop";
    }
    return "transfer";
  }

  return "swap"; // Outgoing is likely a swap or trade
}
