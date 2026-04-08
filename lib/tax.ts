// Sample transaction generator + cost-basis tax engine

export type TxType = "Swap" | "Transfer" | "Yield" | "Airdrop" | "Bridge";

export type Tx = {
  id: string;
  hash: string;
  date: string;          // YYYY-MM-DD
  ts: number;            // unix ms
  token: string;         // ETH, USDC, OKB
  contract: string;      // 0x…
  type: TxType;
  amount: number;        // signed: + receive, − send
  costBasis: number;     // USD (per-tx for disposals)
  proceeds: number;      // USD (per-tx for disposals)
  heldDays: number;      // days held before disposal
  isDisposal: boolean;   // counts as a sale
  isIncome: boolean;     // airdrop / yield → income
};

const TOKENS = [
  { sym: "ETH",  contract: "0x0000000000000000000000000000000000000000", basePrice: 2400 },
  { sym: "USDC", contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", basePrice: 1 },
  { sym: "OKB",  contract: "0x75231f58b43240c9718dd58b4967c5114342a86c", basePrice: 50 },
  { sym: "WBTC", contract: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", basePrice: 65000 },
  { sym: "LINK", contract: "0x514910771af9ca656af840dff83e8264ecf986ca", basePrice: 14 },
  { sym: "UNI",  contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", basePrice: 8 },
  { sym: "ARB",  contract: "0x912ce59144191c1204e64559fe8253a0e49e6548", basePrice: 1.1 },
];

const TYPES: TxType[] = ["Swap", "Swap", "Swap", "Transfer", "Yield", "Airdrop", "Bridge"];

// Seeded RNG so the same wallet always produces the same sample
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const fakeHash = (rnd: () => number) => {
  let h = "0x";
  const chars = "0123456789abcdef";
  for (let i = 0; i < 64; i++) h += chars[Math.floor(rnd() * 16)];
  return h;
};

export function generateSampleTxs(wallet: string, year: string): Tx[] {
  const rnd = mulberry32(hashStringToInt(wallet + year));
  const count = 80 + Math.floor(rnd() * 120); // 80–200 txs
  const txs: Tx[] = [];
  const yearN = parseInt(year, 10);

  for (let i = 0; i < count; i++) {
    const tok = TOKENS[Math.floor(rnd() * TOKENS.length)];
    const type = TYPES[Math.floor(rnd() * TYPES.length)];
    const ts = new Date(Date.UTC(yearN, 0, 1 + Math.floor(rnd() * 360),
      Math.floor(rnd() * 24), Math.floor(rnd() * 60))).getTime();
    const date = fmtDate(new Date(ts));
    const amount = parseFloat((rnd() * 4 + 0.01).toFixed(4));
    const priceJitter = 0.7 + rnd() * 0.6; // 0.7–1.3
    const price = tok.basePrice * priceJitter;
    const costBasisPrice = tok.basePrice * (0.6 + rnd() * 0.6);
    const heldDays = Math.floor(rnd() * 700);

    const isIncome = type === "Yield" || type === "Airdrop";
    const isDisposal = !isIncome && type === "Swap";

    const costBasis = isDisposal ? amount * costBasisPrice : 0;
    const proceeds  = isDisposal ? amount * price : 0;

    txs.push({
      id: `tx-${i}`,
      hash: fakeHash(rnd),
      date, ts,
      token: tok.sym,
      contract: tok.contract,
      type,
      amount: type === "Transfer" && rnd() > 0.5 ? -amount : amount,
      costBasis,
      proceeds,
      heldDays,
      isDisposal,
      isIncome,
    });
  }
  txs.sort((a, b) => b.ts - a.ts);
  return txs;
}

// ---------- Cost basis methods ----------

export type CostBasisMethod = "FIFO" | "HIFO" | "Avg";

export type Totals = {
  proceeds: number;
  costBasis: number;
  gains: number;       // positive only
  losses: number;      // positive number representing losses
  netGains: number;    // gains - losses
  income: number;
  airdrops: { count: number; total: number };
  yieldEvents: { count: number; total: number };
  longTermGains: number;
  shortTermGains: number;
};

export function summarize(txs: Tx[]): Totals {
  let proceeds = 0, costBasis = 0, gains = 0, losses = 0;
  let income = 0;
  let longTermGains = 0, shortTermGains = 0;
  const airdrops = { count: 0, total: 0 };
  const yieldEvents = { count: 0, total: 0 };

  for (const t of txs) {
    if (t.isDisposal) {
      const pl = t.proceeds - t.costBasis;
      proceeds += t.proceeds;
      costBasis += t.costBasis;
      if (pl >= 0) {
        gains += pl;
        if (t.heldDays >= 365) longTermGains += pl;
        else shortTermGains += pl;
      } else {
        losses += -pl;
      }
    }
    if (t.isIncome) {
      const v = t.proceeds || t.amount * 100; // fallback est
      income += v;
      if (t.type === "Airdrop") { airdrops.count++; airdrops.total += v; }
      if (t.type === "Yield")   { yieldEvents.count++; yieldEvents.total += v; }
    }
  }
  return {
    proceeds, costBasis, gains, losses,
    netGains: gains - losses,
    income,
    airdrops, yieldEvents,
    longTermGains, shortTermGains,
  };
}

// Compute estimated tax for a country + cost-basis method.
// Method affects gains slightly (HIFO < FIFO ~ Avg in a rising market).
export function estimateTax(
  totals: Totals,
  country: string,
  method: CostBasisMethod
): { tax: number; allowsOffset: boolean; flatCryptoRate?: number; tdsObligation?: { count: number; total: number } } {
  // Method jitter: HIFO produces lowest gains, Avg in middle, FIFO highest
  const methodMult: Record<CostBasisMethod, number> = { FIFO: 1.0, Avg: 0.92, HIFO: 0.82 };
  const adjGains = Math.max(0, totals.gains * methodMult[method] - totals.losses * (country === "India" ? 0 : 1));

  if (country === "India") {
    // 30% flat on gains, no offset, no income deduction. Plus 1% TDS on disposals over ₹50k (~$600).
    const tax = totals.gains * 0.30 + totals.income * 0.30; // strict 30%
    return {
      tax,
      allowsOffset: false,
      flatCryptoRate: 0.30,
      tdsObligation: { count: 12, total: tax * 0.0033 }, // mock realistic-looking number
    };
  }
  if (country === "Germany") {
    // Long-term (>1yr) is tax-free; short-term taxed at marginal (assume 25%)
    const tax = totals.shortTermGains * 0.25 + totals.income * 0.25;
    return { tax, allowsOffset: true };
  }
  if (country === "United States") {
    // Long-term ~15%, short-term ~22%, income ~22%
    const tax = totals.longTermGains * 0.15 + totals.shortTermGains * 0.22 + totals.income * 0.22;
    return { tax, allowsOffset: true };
  }
  // default ~20%
  const tax = adjGains * 0.20 + totals.income * 0.20;
  return { tax, allowsOffset: true };
}

export const fmt$ = (n: number) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

export const fmtINR = (n: number) =>
  "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function formatHeld(days: number): { label: string; longTerm: boolean } {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return { label: months ? `${years}y ${months}m` : `${years}y`, longTerm: true };
  }
  return { label: `${days}d`, longTerm: false };
}
