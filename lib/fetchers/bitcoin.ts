/**
 * Bitcoin Fetcher (via Blockstream Esplora)
 *
 * Uses the public Blockstream API - no API key needed.
 * Handles UTXO-based accounting.
 */

import type { RawTx } from "../types";
import type { FetchResult } from "./index";

const ESPLORA_BASE = "https://blockstream.info/api";

type EsploraTx = {
  txid: string;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_time?: number;
  };
  vin: {
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey_address?: string;
      value: number;
    };
    is_coinbase: boolean;
  }[];
  vout: {
    scriptpubkey_address?: string;
    value: number;
  }[];
};

export async function fetchBitcoinTransactions(
  address: string,
  startDate: string,
  endDate: string
): Promise<FetchResult> {
  const txs: RawTx[] = [];
  const tokens = new Set<string>();
  const errors: string[] = [];

  const startTs = new Date(startDate).getTime() / 1000;
  const endTs = new Date(endDate).getTime() / 1000;

  // Bitcoin uses the zero address for native BTC
  const btcAddress = "0x0000000000000000000000000000000000000000";
  tokens.add(btcAddress);

  try {
    const allTxs = await fetchAddressTransactions(address);

    for (const tx of allTxs) {
      if (!tx.status.confirmed || !tx.status.block_time) continue;

      const timestamp = tx.status.block_time;
      if (timestamp < startTs || timestamp >= endTs) continue;

      // Calculate amounts in/out for this address
      let amountIn = 0;
      let amountOut = 0;

      // Check outputs (receiving)
      for (const vout of tx.vout) {
        if (vout.scriptpubkey_address?.toLowerCase() === address.toLowerCase()) {
          amountIn += vout.value;
        }
      }

      // Check inputs (sending)
      for (const vin of tx.vin) {
        if (vin.prevout?.scriptpubkey_address?.toLowerCase() === address.toLowerCase()) {
          amountOut += vin.prevout.value;
        }
      }

      // Convert satoshis to BTC
      const btcIn = amountIn / 100_000_000;
      const btcOut = amountOut / 100_000_000;

      // Determine if this is a receive or send
      if (btcIn > 0 && btcOut === 0) {
        // Pure receive
        txs.push({
          hash: tx.txid,
          blockNumber: tx.status.block_height ?? 0,
          timestamp,
          from: "external",
          to: address,
          token: "BTC",
          tokenAddress: btcAddress,
          amount: btcIn,
          direction: "in",
          chain: "Bitcoin",
          type: "transfer",
        });
      } else if (btcOut > 0 && btcIn === 0) {
        // Pure send
        txs.push({
          hash: tx.txid,
          blockNumber: tx.status.block_height ?? 0,
          timestamp,
          from: address,
          to: "external",
          token: "BTC",
          tokenAddress: btcAddress,
          amount: btcOut,
          direction: "out",
          chain: "Bitcoin",
          type: "transfer",
        });
      } else if (btcOut > btcIn) {
        // Net send (with change)
        const netSend = btcOut - btcIn;
        txs.push({
          hash: tx.txid,
          blockNumber: tx.status.block_height ?? 0,
          timestamp,
          from: address,
          to: "external",
          token: "BTC",
          tokenAddress: btcAddress,
          amount: netSend,
          direction: "out",
          chain: "Bitcoin",
          type: "transfer",
        });
      } else if (btcIn > btcOut) {
        // Net receive
        const netReceive = btcIn - btcOut;
        txs.push({
          hash: tx.txid,
          blockNumber: tx.status.block_height ?? 0,
          timestamp,
          from: "external",
          to: address,
          token: "BTC",
          tokenAddress: btcAddress,
          amount: netReceive,
          direction: "in",
          chain: "Bitcoin",
          type: "transfer",
        });
      }
    }

    return { txs, tokens, errors };
  } catch (err) {
    errors.push(`Bitcoin: ${err instanceof Error ? err.message : "Unknown error"}`);
    return { txs: [], tokens, errors };
  }
}

async function fetchAddressTransactions(address: string): Promise<EsploraTx[]> {
  const allTxs: EsploraTx[] = [];
  let lastTxid: string | undefined;

  // Esplora paginates by last_seen_txid
  do {
    const url = lastTxid
      ? `${ESPLORA_BASE}/address/${address}/txs/chain/${lastTxid}`
      : `${ESPLORA_BASE}/address/${address}/txs`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 400) {
        // Invalid address
        throw new Error("Invalid Bitcoin address");
      }
      throw new Error(`Blockstream API error: ${response.status}`);
    }

    const txs = (await response.json()) as EsploraTx[];

    if (txs.length === 0) break;

    allTxs.push(...txs);
    lastTxid = txs[txs.length - 1].txid;

    // Rate limiting
    await new Promise((r) => setTimeout(r, 100));
  } while (allTxs.length < 5000); // Cap

  return allTxs;
}
