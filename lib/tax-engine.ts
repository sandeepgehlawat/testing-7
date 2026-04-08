/**
 * Tax Engine - Real FIFO/HIFO/Average cost basis matching
 *
 * This engine processes raw blockchain transactions into proper tax lots
 * and matches disposals to acquisitions using the specified cost basis method.
 */

import type {
  RawTx,
  AcquisitionLot,
  DisposalEvent,
  PricePoint,
  Totals,
  CostBasisMethod,
} from "./types";
import type { Tx, TxType } from "./tax";

type LotMap = Map<string, AcquisitionLot[]>; // tokenAddress -> lots

export class TaxEngine {
  private lots: LotMap = new Map();
  private disposals: DisposalEvent[] = [];
  private incomeEvents: AcquisitionLot[] = [];
  private method: CostBasisMethod;
  private year: number;
  private priceCache: Map<string, number> = new Map(); // "tokenId:date" -> price

  constructor(method: CostBasisMethod, year: number) {
    this.method = method;
    this.year = year;
  }

  /** Build price cache from price points */
  loadPrices(prices: PricePoint[]): void {
    for (const p of prices) {
      this.priceCache.set(`${p.tokenId}:${p.date}`, p.priceUsd);
    }
  }

  /** Get price from cache */
  private getPrice(tokenId: string, date: string): number {
    return this.priceCache.get(`${tokenId}:${date}`) ?? 0;
  }

  /**
   * Process raw transactions into lots and disposals
   * Assumes transactions are sorted by timestamp ascending
   */
  processTransactions(
    txs: RawTx[],
    tokenToCoingecko: Map<string, string> // tokenAddress -> coingeckoId
  ): void {
    // Sort by timestamp ascending (oldest first)
    const sorted = [...txs].sort((a, b) => a.timestamp - b.timestamp);

    for (const tx of sorted) {
      const date = this.timestampToDate(tx.timestamp);
      const coingeckoId = tokenToCoingecko.get(tx.tokenAddress.toLowerCase()) ?? tx.token.toLowerCase();
      const pricePerUnit = this.getPrice(coingeckoId, date);

      if (tx.direction === "in") {
        // Acquisition - create a new lot
        const isIncome = tx.type === "airdrop" || tx.type === "yield";
        const lot: AcquisitionLot = {
          id: `lot-${tx.hash}-${tx.token}`,
          txHash: tx.hash,
          date,
          timestamp: tx.timestamp * 1000,
          token: tx.token,
          tokenAddress: tx.tokenAddress,
          amount: tx.amount,
          originalAmount: tx.amount,
          costBasisPerUnit: pricePerUnit,
          totalCostBasis: tx.amount * pricePerUnit,
          chain: tx.chain,
          isIncome,
          incomeType: isIncome ? (tx.type as "airdrop" | "yield") : undefined,
        };

        // Add to lots by token address
        const key = tx.tokenAddress.toLowerCase();
        if (!this.lots.has(key)) {
          this.lots.set(key, []);
        }
        this.lots.get(key)!.push(lot);

        // Track income events separately
        if (isIncome) {
          this.incomeEvents.push(lot);
        }
      } else {
        // Disposal - will be matched to lots later
        const disposal: DisposalEvent = {
          id: `disposal-${tx.hash}-${tx.token}`,
          txHash: tx.hash,
          date,
          timestamp: tx.timestamp * 1000,
          token: tx.token,
          tokenAddress: tx.tokenAddress,
          amount: tx.amount,
          proceeds: tx.amount * pricePerUnit,
          proceedsPerUnit: pricePerUnit,
          chain: tx.chain,
          matchedLots: [],
          totalCostBasis: 0,
          gain: 0,
          isLongTerm: false,
        };

        this.disposals.push(disposal);
      }
    }
  }

  /**
   * Match disposals to acquisition lots using the selected method
   */
  matchDisposals(): void {
    for (const disposal of this.disposals) {
      const key = disposal.tokenAddress.toLowerCase();
      const lots = this.lots.get(key) ?? [];

      // Sort lots based on method
      const sortedLots = this.sortLotsForMethod(lots);

      let remainingAmount = disposal.amount;
      let totalCostBasis = 0;
      const matchedLots: DisposalEvent["matchedLots"] = [];

      for (const lot of sortedLots) {
        if (remainingAmount <= 0) break;
        if (lot.amount <= 0) continue;

        const amountFromLot = Math.min(remainingAmount, lot.amount);
        const costBasisFromLot = amountFromLot * lot.costBasisPerUnit;
        const heldDays = Math.floor((disposal.timestamp - lot.timestamp) / (1000 * 60 * 60 * 24));
        const isLongTerm = heldDays >= 365;

        matchedLots.push({
          lotId: lot.id,
          amount: amountFromLot,
          costBasis: costBasisFromLot,
          heldDays,
          isLongTerm,
        });

        // Deduct from lot
        lot.amount -= amountFromLot;
        lot.totalCostBasis = lot.amount * lot.costBasisPerUnit;

        totalCostBasis += costBasisFromLot;
        remainingAmount -= amountFromLot;
      }

      disposal.matchedLots = matchedLots;
      disposal.totalCostBasis = totalCostBasis;
      disposal.gain = disposal.proceeds - totalCostBasis;
      disposal.isLongTerm = matchedLots.length > 0 && matchedLots.every((m) => m.isLongTerm);
    }
  }

  /** Sort lots based on cost basis method */
  private sortLotsForMethod(lots: AcquisitionLot[]): AcquisitionLot[] {
    const available = lots.filter((l) => l.amount > 0);

    switch (this.method) {
      case "FIFO":
        // First In, First Out - sort by date ascending
        return available.sort((a, b) => a.timestamp - b.timestamp);

      case "HIFO":
        // Highest In, First Out - sort by cost basis descending
        return available.sort((a, b) => b.costBasisPerUnit - a.costBasisPerUnit);

      case "Avg":
        // For average, we don't actually sort - we compute weighted average
        // But for matching purposes, we still need to track lots
        // The cost basis will be recalculated based on average
        return available.sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  /** For Average Cost method, recalculate all disposals with weighted average */
  private applyAverageCost(): void {
    if (this.method !== "Avg") return;

    // Group disposals by token
    const disposalsByToken = new Map<string, DisposalEvent[]>();
    for (const d of this.disposals) {
      const key = d.tokenAddress.toLowerCase();
      if (!disposalsByToken.has(key)) {
        disposalsByToken.set(key, []);
      }
      disposalsByToken.get(key)!.push(d);
    }

    // For each token, recalculate cost basis using running average
    for (const [tokenAddr, disposals] of disposalsByToken) {
      const allLots = this.lots.get(tokenAddr) ?? [];

      // Sort everything by timestamp
      type Event = { type: "lot" | "disposal"; timestamp: number; data: AcquisitionLot | DisposalEvent };
      const events: Event[] = [
        ...allLots.map((l) => ({ type: "lot" as const, timestamp: l.timestamp, data: l })),
        ...disposals.map((d) => ({ type: "disposal" as const, timestamp: d.timestamp, data: d })),
      ].sort((a, b) => a.timestamp - b.timestamp);

      let totalAmount = 0;
      let totalCostBasis = 0;

      for (const event of events) {
        if (event.type === "lot") {
          const lot = event.data as AcquisitionLot;
          totalAmount += lot.originalAmount;
          totalCostBasis += lot.originalAmount * lot.costBasisPerUnit;
        } else {
          const disposal = event.data as DisposalEvent;
          const avgCostPerUnit = totalAmount > 0 ? totalCostBasis / totalAmount : 0;
          const costBasis = disposal.amount * avgCostPerUnit;

          // Update disposal with average cost basis
          disposal.totalCostBasis = costBasis;
          disposal.gain = disposal.proceeds - costBasis;

          // Deduct from running totals
          totalAmount -= disposal.amount;
          totalCostBasis -= costBasis;
        }
      }
    }
  }

  /**
   * Summarize totals for the tax year
   */
  summarize(): Totals {
    // Filter disposals to the tax year
    const yearStart = new Date(`${this.year}-01-01`).getTime();
    const yearEnd = new Date(`${this.year + 1}-01-01`).getTime();

    const yearDisposals = this.disposals.filter(
      (d) => d.timestamp >= yearStart && d.timestamp < yearEnd
    );

    let proceeds = 0;
    let costBasis = 0;
    let gains = 0;
    let losses = 0;
    let longTermGains = 0;
    let shortTermGains = 0;

    for (const d of yearDisposals) {
      proceeds += d.proceeds;
      costBasis += d.totalCostBasis;

      if (d.gain >= 0) {
        gains += d.gain;
        if (d.isLongTerm) {
          longTermGains += d.gain;
        } else {
          shortTermGains += d.gain;
        }
      } else {
        losses += Math.abs(d.gain);
      }
    }

    // Income events in the tax year
    const yearIncome = this.incomeEvents.filter(
      (i) => i.timestamp >= yearStart && i.timestamp < yearEnd
    );

    let income = 0;
    const airdrops = { count: 0, total: 0 };
    const yieldEvents = { count: 0, total: 0 };

    for (const i of yearIncome) {
      const value = i.totalCostBasis; // Value at time of receipt
      income += value;

      if (i.incomeType === "airdrop") {
        airdrops.count++;
        airdrops.total += value;
      } else if (i.incomeType === "yield" || i.incomeType === "staking") {
        yieldEvents.count++;
        yieldEvents.total += value;
      }
    }

    return {
      proceeds,
      costBasis,
      gains,
      losses,
      netGains: gains - losses,
      income,
      airdrops,
      yieldEvents,
      longTermGains,
      shortTermGains,
    };
  }

  /**
   * Get transactions formatted for display
   */
  getTransactions(): Tx[] {
    const yearStart = new Date(`${this.year}-01-01`).getTime();
    const yearEnd = new Date(`${this.year + 1}-01-01`).getTime();

    const txs: Tx[] = [];

    // Add disposals
    for (const d of this.disposals) {
      if (d.timestamp < yearStart || d.timestamp >= yearEnd) continue;

      const avgHeldDays =
        d.matchedLots.length > 0
          ? Math.round(
              d.matchedLots.reduce((sum, m) => sum + m.heldDays * m.amount, 0) /
                d.matchedLots.reduce((sum, m) => sum + m.amount, 0)
            )
          : 0;

      txs.push({
        id: d.id,
        hash: d.txHash,
        date: d.date,
        ts: d.timestamp,
        token: d.token,
        contract: d.tokenAddress,
        type: "Swap" as TxType,
        amount: -d.amount,
        costBasis: d.totalCostBasis,
        proceeds: d.proceeds,
        heldDays: avgHeldDays,
        isDisposal: true,
        isIncome: false,
      });
    }

    // Add income events
    for (const i of this.incomeEvents) {
      if (i.timestamp < yearStart || i.timestamp >= yearEnd) continue;

      txs.push({
        id: i.id,
        hash: i.txHash,
        date: i.date,
        ts: i.timestamp,
        token: i.token,
        contract: i.tokenAddress,
        type: (i.incomeType === "airdrop" ? "Airdrop" : "Yield") as TxType,
        amount: i.originalAmount,
        costBasis: 0,
        proceeds: i.totalCostBasis,
        heldDays: 0,
        isDisposal: false,
        isIncome: true,
      });
    }

    // Sort by timestamp descending (newest first)
    return txs.sort((a, b) => b.ts - a.ts);
  }

  /** Get all disposals for the year */
  getDisposals(): DisposalEvent[] {
    const yearStart = new Date(`${this.year}-01-01`).getTime();
    const yearEnd = new Date(`${this.year + 1}-01-01`).getTime();
    return this.disposals.filter((d) => d.timestamp >= yearStart && d.timestamp < yearEnd);
  }

  /** Get remaining lots (for debugging/display) */
  getRemainingLots(): AcquisitionLot[] {
    const result: AcquisitionLot[] = [];
    for (const lots of this.lots.values()) {
      result.push(...lots.filter((l) => l.amount > 0));
    }
    return result;
  }

  /** Convert Unix seconds to YYYY-MM-DD */
  private timestampToDate(unixSeconds: number): string {
    const d = new Date(unixSeconds * 1000);
    return d.toISOString().split("T")[0];
  }
}

/**
 * Process real transactions using the tax engine
 */
export function processRealTransactions(
  rawTxs: RawTx[],
  prices: PricePoint[],
  tokenToCoingecko: Map<string, string>,
  method: CostBasisMethod,
  year: number
): { txs: Tx[]; totals: Totals; disposals: DisposalEvent[] } {
  const engine = new TaxEngine(method, year);
  engine.loadPrices(prices);
  engine.processTransactions(rawTxs, tokenToCoingecko);
  engine.matchDisposals();

  return {
    txs: engine.getTransactions(),
    totals: engine.summarize(),
    disposals: engine.getDisposals(),
  };
}
