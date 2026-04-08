"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, Search } from "lucide-react";
import type { Tx, TxType } from "@/lib/tax";
import { formatHeld } from "@/lib/tax";

const PAGE_SIZE = 50;
const FILTERS: ({ key: "All" } | { key: TxType })[] = [
  { key: "All" }, { key: "Swap" }, { key: "Transfer" },
  { key: "Yield" }, { key: "Airdrop" }, { key: "Bridge" },
];

const TYPE_COLORS: Record<TxType, string> = {
  Swap:     "bg-brand-50 text-brand-700 border-brand-100",
  Transfer: "bg-bg text-sub border-line",
  Yield:    "bg-emerald-50 text-emerald-700 border-emerald-100",
  Airdrop:  "bg-amber-50 text-amber-700 border-amber-100",
  Bridge:   "bg-sky-50 text-sky-700 border-sky-100",
};

type SortKey = "date" | "token" | "amount" | "costBasis" | "proceeds" | "gainLoss" | "heldDays";

export function TransactionTable({
  txs,
  country,
}: { txs: Tx[]; country: string }) {
  const [filter, setFilter] = useState<"All" | TxType>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let r = txs;
    if (filter !== "All") r = r.filter((t) => t.type === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      r = r.filter((t) => t.token.toLowerCase().includes(q) || t.hash.toLowerCase().includes(q));
    }
    return r;
  }, [txs, filter, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      let av: number | string, bv: number | string;
      switch (sort.key) {
        case "date":      av = a.ts; bv = b.ts; break;
        case "token":     av = a.token; bv = b.token; break;
        case "amount":    av = a.amount; bv = b.amount; break;
        case "costBasis": av = a.costBasis; bv = b.costBasis; break;
        case "proceeds":  av = a.proceeds; bv = b.proceeds; break;
        case "gainLoss":  av = a.proceeds - a.costBasis; bv = b.proceeds - b.costBasis; break;
        case "heldDays":  av = a.heldDays; bv = b.heldDays; break;
      }
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
    return copy;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (page > totalPages) setPage(1);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const sel = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setPage(1); }}
                className={`h-9 px-4 rounded-full text-[12px] font-semibold border transition ${
                  sel
                    ? "bg-gradient-to-b from-brand-500 to-brand-700 text-white border-transparent shadow-[0_4px_12px_-4px_rgba(91,70,232,.5)]"
                    : "bg-white text-sub border-line hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40"
                }`}
              >
                {f.key}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search token or tx hash"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-line bg-white text-sm text-ink placeholder-sub/60 outline-none transition hover:border-brand-200 focus:border-brand-500 focus:shadow-ringBrand"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-line overflow-hidden bg-white">
        <div className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full text-[13px] tabular-nums">
            <thead className="bg-bg/60 border-b border-line">
              <tr className="text-left text-[11px] uppercase tracking-wider text-sub font-semibold">
                <Th sortKey="date"      label="Date"       align="left"  current={sort} onSort={toggleSort}/>
                <Th sortKey="token"     label="Token"      align="left"  current={sort} onSort={toggleSort}/>
                <Th sortKey="amount"    label="Amount"     align="right" current={sort} onSort={toggleSort}/>
                <Th sortKey="costBasis" label="Cost basis" align="right" current={sort} onSort={toggleSort}/>
                <Th sortKey="proceeds"  label="Proceeds"   align="right" current={sort} onSort={toggleSort}/>
                <Th sortKey="gainLoss"  label="Gain / Loss" align="right" current={sort} onSort={toggleSort}/>
                <Th sortKey="heldDays"  label="Held"       align="left"  current={sort} onSort={toggleSort}/>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Tx</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-sub">No transactions match this filter.</td>
                </tr>
              )}
              {pageRows.map((t) => {
                const pl = t.proceeds - t.costBasis;
                const isGain = pl >= 0;
                const held = formatHeld(t.heldDays);
                const taxFreeDE = country === "Germany" && held.longTerm;
                return (
                  <tr key={t.id} className="border-b border-line/70 last:border-0 hover:bg-bg/40 transition">
                    <td className="px-4 py-3 font-mono text-sub">{t.date}</td>
                    <td className="px-4 py-3 font-semibold text-ink" title={t.contract}>{t.token}</td>
                    <td className="px-4 py-3 font-mono text-right">{t.amount.toFixed(4)}</td>
                    <td className="px-4 py-3 font-mono text-right">{t.isDisposal ? `$${t.costBasis.toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-3 font-mono text-right">{t.isDisposal ? `$${t.proceeds.toFixed(2)}` : "—"}</td>
                    <td className={`px-4 py-3 font-mono font-bold text-right ${
                      !t.isDisposal ? "text-sub" : isGain ? "text-gain" : "text-loss"
                    }`}>
                      {t.isDisposal ? `${isGain ? "+" : "-"}$${Math.abs(pl).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={taxFreeDE ? "text-gain font-semibold" : "text-sub"}>
                        {held.label}{taxFreeDE && " · tax-free"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${TYPE_COLORS[t.type]}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`https://www.oklink.com/xlayer/tx/${t.hash}`}
                        target="_blank" rel="noopener noreferrer"
                        data-no-lenis
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sub hover:text-brand-700 hover:bg-brand-50 transition"
                        aria-label="View on explorer"
                      >
                        <ExternalLink size={13}/>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line text-[12px] text-sub">
          <span>{sorted.length} {sorted.length === 1 ? "transaction" : "transactions"}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 h-9 rounded-lg border border-line bg-white text-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-300 hover:text-brand-700 transition"
            >
              ← Prev
            </button>
            <span className="font-semibold text-ink">Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 h-9 rounded-lg border border-line bg-white text-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-300 hover:text-brand-700 transition"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({
  sortKey, label, align, current, onSort,
}: {
  sortKey: SortKey;
  label: string;
  align: "left" | "right";
  current: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
}) {
  const active = current.key === sortKey;
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-ink transition ${active ? "text-ink" : ""}`}
      >
        {label}
        <ArrowUpDown size={11} className={active ? "opacity-80" : "opacity-30"} />
      </button>
    </th>
  );
}
