import type { Tx, Totals, CostBasisMethod } from "./tax";

export type Phase = "idle" | "processing" | "error";

export type Result = {
  wallet: string;
  country: string;
  year: string;
  txs: Tx[];
  totals: Totals;
};

export type Counter = {
  txs: number;
  tokens: number;
  prices: number;
  total: number;
};

export type { Tx, Totals, CostBasisMethod };
