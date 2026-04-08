/**
 * Solana Fetcher (via Alchemy)
 *
 * Uses Alchemy's Solana API for transaction history.
 * Handles native SOL and SPL tokens.
 */

import type { RawTx } from "../types";
import type { FetchResult } from "./index";

const ALCHEMY_SOLANA_URL = "https://solana-mainnet.g.alchemy.com/v2/";

// Native SOL address representation
const SOL_ADDRESS = "So11111111111111111111111111111111111111112";

type SignatureInfo = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown | null;
};

type ParsedInstruction = {
  program: string;
  programId: string;
  parsed?: {
    type: string;
    info: {
      source?: string;
      destination?: string;
      lamports?: number;
      amount?: string;
      authority?: string;
      mint?: string;
      tokenAmount?: {
        amount: string;
        decimals: number;
        uiAmount: number;
      };
    };
  };
};

type ParsedTransaction = {
  blockTime: number | null;
  slot: number;
  transaction: {
    signatures: string[];
    message: {
      instructions: ParsedInstruction[];
    };
  };
  meta: {
    err: unknown | null;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: {
      accountIndex: number;
      mint: string;
      owner: string;
      uiTokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number;
      };
    }[];
    postTokenBalances?: {
      accountIndex: number;
      mint: string;
      owner: string;
      uiTokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number;
      };
    }[];
  } | null;
};

export async function fetchSolanaTransactions(
  address: string,
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

  const url = `${ALCHEMY_SOLANA_URL}${apiKey}`;
  const txs: RawTx[] = [];
  const tokens = new Set<string>();
  const errors: string[] = [];

  const startTs = new Date(startDate).getTime() / 1000;
  const endTs = new Date(endDate).getTime() / 1000;

  try {
    // Get signatures for address
    const signatures = await getSignaturesForAddress(url, address, startTs, endTs);

    // Fetch transaction details in batches
    const batchSize = 10;
    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      const txDetails = await Promise.all(
        batch.map((sig) => getTransaction(url, sig.signature))
      );

      for (let j = 0; j < txDetails.length; j++) {
        const tx = txDetails[j];
        const sigInfo = batch[j];

        if (!tx || tx.meta?.err) continue;

        const timestamp = tx.blockTime ?? sigInfo.blockTime ?? 0;
        if (timestamp < startTs || timestamp >= endTs) continue;

        // Process parsed instructions for transfers
        for (const ix of tx.transaction.message.instructions) {
          if (!ix.parsed) continue;

          // Native SOL transfer
          if (ix.program === "system" && ix.parsed.type === "transfer") {
            const info = ix.parsed.info;
            const from = info.source ?? "";
            const to = info.destination ?? "";
            const isIncoming = to.toLowerCase() === address.toLowerCase();
            const isOutgoing = from.toLowerCase() === address.toLowerCase();

            if (!isIncoming && !isOutgoing) continue;

            const amount = (info.lamports ?? 0) / 1_000_000_000;
            if (amount <= 0) continue;

            tokens.add(SOL_ADDRESS);

            txs.push({
              hash: tx.transaction.signatures[0],
              blockNumber: tx.slot,
              timestamp,
              from,
              to,
              token: "SOL",
              tokenAddress: SOL_ADDRESS,
              amount,
              direction: isIncoming ? "in" : "out",
              chain: "Solana",
              type: "transfer",
            });
          }

          // SPL Token transfer
          if (ix.program === "spl-token" && ix.parsed.type === "transfer") {
            const info = ix.parsed.info;
            const from = info.authority ?? info.source ?? "";
            const to = info.destination ?? "";
            const isIncoming = to.toLowerCase() === address.toLowerCase();
            const isOutgoing = from.toLowerCase() === address.toLowerCase();

            if (!isIncoming && !isOutgoing) continue;

            const amount = parseFloat(info.amount ?? "0");
            if (amount <= 0) continue;

            const mint = info.mint ?? "unknown";
            tokens.add(mint);

            txs.push({
              hash: tx.transaction.signatures[0],
              blockNumber: tx.slot,
              timestamp,
              from,
              to,
              token: getTokenSymbol(mint),
              tokenAddress: mint,
              amount,
              direction: isIncoming ? "in" : "out",
              chain: "Solana",
              type: "swap",
            });
          }

          // SPL Token transferChecked (includes mint info)
          if (ix.program === "spl-token" && ix.parsed.type === "transferChecked") {
            const info = ix.parsed.info;
            const from = info.authority ?? info.source ?? "";
            const to = info.destination ?? "";
            const isIncoming = to.toLowerCase() === address.toLowerCase();
            const isOutgoing = from.toLowerCase() === address.toLowerCase();

            if (!isIncoming && !isOutgoing) continue;

            const amount = info.tokenAmount?.uiAmount ?? 0;
            if (amount <= 0) continue;

            const mint = info.mint ?? "unknown";
            tokens.add(mint);

            txs.push({
              hash: tx.transaction.signatures[0],
              blockNumber: tx.slot,
              timestamp,
              from,
              to,
              token: getTokenSymbol(mint),
              tokenAddress: mint,
              amount,
              direction: isIncoming ? "in" : "out",
              chain: "Solana",
              type: "swap",
            });
          }
        }

        // Also check token balance changes for any missed transfers
        if (tx.meta?.preTokenBalances && tx.meta?.postTokenBalances) {
          const preByMint = new Map<string, number>();
          const postByMint = new Map<string, number>();

          for (const bal of tx.meta.preTokenBalances) {
            if (bal.owner.toLowerCase() === address.toLowerCase()) {
              preByMint.set(bal.mint, bal.uiTokenAmount.uiAmount);
            }
          }

          for (const bal of tx.meta.postTokenBalances) {
            if (bal.owner.toLowerCase() === address.toLowerCase()) {
              postByMint.set(bal.mint, bal.uiTokenAmount.uiAmount);
            }
          }

          // Find balance changes
          const allMints = new Set([
            ...Array.from(preByMint.keys()),
            ...Array.from(postByMint.keys()),
          ]);
          for (const mint of Array.from(allMints)) {
            const pre = preByMint.get(mint) ?? 0;
            const post = postByMint.get(mint) ?? 0;
            const diff = post - pre;

            if (Math.abs(diff) < 0.000001) continue;

            // Check if we already have this transfer
            const hash = tx.transaction.signatures[0];
            const exists = txs.some(
              (t) => t.hash === hash && t.tokenAddress === mint
            );
            if (exists) continue;

            tokens.add(mint);

            txs.push({
              hash,
              blockNumber: tx.slot,
              timestamp,
              from: diff < 0 ? address : "",
              to: diff > 0 ? address : "",
              token: getTokenSymbol(mint),
              tokenAddress: mint,
              amount: Math.abs(diff),
              direction: diff > 0 ? "in" : "out",
              chain: "Solana",
              type: "swap",
            });
          }
        }
      }

      // Rate limiting between batches
      if (i + batchSize < signatures.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduped = txs.filter((tx) => {
      const key = `${tx.hash}-${tx.tokenAddress}-${tx.direction}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { txs: deduped, tokens, errors };
  } catch (err) {
    errors.push(`Solana: ${err instanceof Error ? err.message : "Unknown error"}`);
    return { txs: [], tokens, errors };
  }
}

async function getSignaturesForAddress(
  url: string,
  address: string,
  startTs: number,
  endTs: number
): Promise<SignatureInfo[]> {
  const allSignatures: SignatureInfo[] = [];
  let before: string | undefined;
  let rateLimitRetries = 0;
  const maxRateLimitRetries = 3;

  do {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [
          address,
          {
            limit: 1000,
            ...(before ? { before } : {}),
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429 && rateLimitRetries < maxRateLimitRetries) {
        // Rate limited - wait and retry with exponential backoff
        rateLimitRetries++;
        await new Promise((r) => setTimeout(r, 1000 * rateLimitRetries));
        continue;
      }
      throw new Error(`Alchemy Solana API error: ${response.status}`);
    }
    rateLimitRetries = 0; // Reset on success

    const data = (await response.json()) as { result: SignatureInfo[] };
    const sigs = data.result ?? [];

    if (sigs.length === 0) break;

    // Filter by timestamp and add to results
    for (const sig of sigs) {
      const ts = sig.blockTime ?? 0;

      // If we've gone past the start date, we're done
      if (ts < startTs) {
        return allSignatures;
      }

      // Only include if within date range
      if (ts >= startTs && ts < endTs) {
        allSignatures.push(sig);
      }
    }

    before = sigs[sigs.length - 1].signature;

    // Rate limiting
    await new Promise((r) => setTimeout(r, 100));
  } while (allSignatures.length < 5000);

  return allSignatures;
}

async function getTransaction(
  url: string,
  signature: string,
  retries = 3
): Promise<ParsedTransaction | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          {
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 0,
          },
        ],
      }),
    });

    if (response.status === 429) {
      // Rate limited - exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { result: ParsedTransaction | null };
    return data.result;
  }
  return null;
}

// Common Solana token symbols by mint address
const TOKEN_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "WETH",
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": "stSOL",
};

function getTokenSymbol(mint: string): string {
  return TOKEN_SYMBOLS[mint] ?? mint.slice(0, 6);
}
