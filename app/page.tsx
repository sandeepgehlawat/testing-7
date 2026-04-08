"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { CommandPalette } from "@/components/CommandPalette";
import { CountUp } from "@/components/CountUp";
import { useToast } from "@/components/Toast";
import { TransactionTable } from "@/components/TransactionTable";
import {
  generateSampleTxs, summarize, estimateTax,
  type Tx, type Totals, type CostBasisMethod,
} from "@/lib/tax";
import { generateTaxReport } from "@/lib/pdf";
import {
  Calculator, Wallet, Globe2, Calendar, Zap, Sparkles, ArrowRight,
  TrendingUp, TrendingDown, Download, ShieldCheck, Bot, FileText, Network, Lock, Loader2,
  Gauge, Coins, Receipt, ChevronRight, Github,
  Terminal, Copy, Check, Star, Menu, X, ClipboardPaste, StopCircle, Search, Info,
} from "lucide-react";
import { Select } from "@/components/Select";
import { CHAINS, COUNTRIES, YEARS, flag, fmt, detectChain } from "@/lib/constants";

const INSTALL_CMDS = {
  npm:  "npx chaintax-skill install",
  pnpm: "pnpm dlx chaintax-skill install",
  yarn: "yarn dlx chaintax-skill install",
  bun:  "bunx chaintax-skill install",
} as const;
type Pkg = keyof typeof INSTALL_CMDS;
const INSTALL_CMD = INSTALL_CMDS.npm;

type Result = {
  wallet:string; country:string; year:string;
  txs: Tx[];
  totals: Totals;
};

const SAMPLE_WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth
const STORAGE_KEY = "chaintax:v1";

export default function Home() {
  const { toast } = useToast();

  // Hydrate from localStorage on mount
  const [wallet,setWallet] = useState("");
  const [country,setCountry] = useState("");
  const [year,setYear] = useState("2026");
  const [chains,setChains] = useState<string[]>(["Ethereum","Base"]);
  const [mobileNav,setMobileNav] = useState(false);
  const [elapsed,setElapsed] = useState(0);
  const cancelRef = useRef(false);

  // Restore once — defensively
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        if (typeof s.wallet === "string")  setWallet(s.wallet);
        if (typeof s.country === "string") setCountry(s.country);
        if (typeof s.year === "string")    setYear(s.year);
        if (Array.isArray(s.chains) && s.chains.every((x:unknown)=>typeof x==="string") && s.chains.length) setChains(s.chains);
      }
    } catch {
      // Corrupt blob — wipe
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }, []);
  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallet, country, year, chains }));
    } catch {}
  }, [wallet, country, year, chains]);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (mobileNav) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileNav]);
  const [loading,setLoading] = useState(false);
  const [result,setResult] = useState<Result|null>(null);
  // progress state
  type Phase = "idle" | "processing" | "error";
  const [phase,setPhase] = useState<Phase>("idle");
  const [progress01,setProgress01] = useState(0);
  const [stepIdx,setStepIdx] = useState(0);
  const [counter,setCounter] = useState({txs:0,tokens:0,prices:0,total:0});
  const [errMsg,setErrMsg] = useState("");
  const [copied,setCopied] = useState(false);
  const [pkg,setPkg] = useState<Pkg>("npm");
  const [method,setMethod] = useState<CostBasisMethod>("FIFO");
  const [showTxs,setShowTxs] = useState(false);
  // Demo mode only - real tax calculation is handled by the chaintax-skill CLI

  // India is FIFO-only — keep method in sync
  useEffect(() => {
    if (country === "India" && method !== "FIFO") setMethod("FIFO");
  }, [country, method]);

  // scroll progress bar (raw, no spring → no extra repaints)
  const { scrollYProgress: progress } = useScroll();

  // shrink nav after scroll — pure CSS data-attr toggle (no React re-renders)
  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;";
    document.body.prepend(sentinel);
    const io = new IntersectionObserver(
      ([entry]) => document.documentElement.dataset.scrolled = entry.isIntersecting ? "false" : "true",
      { rootMargin: "0px" }
    );
    io.observe(sentinel);
    return () => { io.disconnect(); sentinel.remove(); };
  }, []);

  const copyInstall = async () => {
    try { await navigator.clipboard.writeText(INSTALL_CMDS[pkg]); } catch {}
    setCopied(true);
    toast("Install command copied");
    setTimeout(()=>setCopied(false),1800);
  };

  const fillSample = () => {
    setWallet(SAMPLE_WALLET);
    if (!country) setCountry("United States");
    setChains((prev)=> prev.includes("Ethereum") ? prev : [...prev, "Ethereum"]);
    toast("Sample wallet loaded · vitalik.eth");
  };

  const runSampleDemo = async () => {
    setWallet(SAMPLE_WALLET);
    setCountry("India");        // demo India to show TDS card + FIFO lock
    setYear("2024");
    setChains(["Ethereum","X Layer"]);
    toast("Running sample · India 2024");
    // Submit on next tick after state has propagated
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const fakeEvt = { preventDefault: () => {} } as React.FormEvent;
    await onSubmit(fakeEvt);
  };

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) onWalletChange(t);
    } catch {
      toast("Clipboard unavailable", "error");
    }
  };

  const cancelScan = () => {
    cancelRef.current = true;
    setLoading(false);
    setPhase("idle");
    toast("Scan cancelled", "error");
  };

  // CSV export — proper filename + immediate download + toast
  const exportCSV = () => {
    if (!result) return;
    const head = ["date","token","amount","cost_basis_usd","proceeds_usd","gain_loss_usd","held_days","type","tx_hash"];
    const rows = result.txs.map((t) => [
      t.date, t.token, t.amount.toFixed(4),
      t.costBasis.toFixed(2), t.proceeds.toFixed(2),
      (t.proceeds - t.costBasis).toFixed(2),
      String(t.heldDays), t.type, t.hash,
    ]);
    const escape = (s: string) => {
      // Prevent CSV formula injection (Excel/Sheets exec '=', '+', '-', '@', tabs)
      let v = s;
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const csv = [head, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const code = (COUNTRIES.find(c => c.value === result.country)?.code ?? "xx").toUpperCase();
    const short = result.wallet.slice(2, 10).toLowerCase();
    const chain = (chains[0] ?? "chain").toLowerCase().replace(/\s+/g, "");
    const filename = `${chain}-tax-${result.year}-${code}-0x${short}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`${filename} downloaded`);
  };

  const toggleChain = (c:string) =>
    setChains(p => p.includes(c) ? p.filter(x=>x!==c) : [...p,c]);

  const onWalletChange = (v:string) => {
    setWallet(v);
    const guess = detectChain(v);
    if (!guess) return;
    // Replace any previously auto-detected family with the new one (don't accumulate stale ones)
    const FAMILIES = new Set(["Ethereum","Bitcoin","Solana"]);
    setChains(p => {
      const stripped = p.filter(c => !FAMILIES.has(c));
      return stripped.includes(guess) ? p : [...stripped, guess];
    });
  };

  const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms));

  // PDF export function
  const exportPDF = async () => {
    if (!result) return;
    const taxInfo = estimateTax(result.totals, result.country, method);
    try {
      const blob = await generateTaxReport({
        wallet: result.wallet,
        country: result.country,
        year: result.year,
        method,
        txs: result.txs,
        totals: result.totals,
        estimatedTax: taxInfo.tax,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const code = (COUNTRIES.find(c => c.value === result.country)?.code ?? "xx").toUpperCase();
      const short = result.wallet.slice(2, 10).toLowerCase();
      a.href = url;
      a.download = `chaintax-${result.year}-${code}-0x${short}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("PDF report downloaded");
    } catch (err) {
      toast("Failed to generate PDF", "error");
      console.error(err);
    }
  };

  const onSubmit = async (e:React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setLoading(true);
    setPhase("processing");
    setProgress01(0);
    setStepIdx(0);
    setCounter({txs:0,tokens:0,prices:0,total:0});
    setErrMsg("");
    setElapsed(0);
    cancelRef.current = false;

    const t0 = performance.now();
    const timer = setInterval(() => setElapsed((performance.now() - t0) / 1000), 100);
    const checkCancel = () => { if (cancelRef.current) throw new Error("__cancelled__"); };

    try {
        // ============ DEMO MODE: Sample data ============
        // For real tax calculation, use: npx chaintax-skill calculate
        // Step 0 — Connect
        setStepIdx(0); setProgress01(0.05);
        await sleep(500);

        // Step 1 — Find transactions
        setStepIdx(1); setProgress01(0.18);
        const totalTxs = Math.floor(Math.random()*180+60);
        for (let i=0;i<=totalTxs;i+=Math.max(1,Math.floor(totalTxs/12))){
          setCounter(c=>({...c,txs:Math.min(i,totalTxs),total:totalTxs}));
          await sleep(35); checkCancel();
        }
        setCounter(c=>({...c,txs:totalTxs,total:totalTxs,tokens:Math.floor(Math.random()*8+5)}));

        // Step 2 — Fetch historical prices
        setStepIdx(2); setProgress01(0.34);
        for (let i=0;i<=totalTxs;i+=Math.max(1,Math.floor(totalTxs/16))){
          setCounter(c=>({...c,prices:Math.min(i,totalTxs)}));
          setProgress01(0.34 + (i/totalTxs)*0.28);
          await sleep(28); checkCancel();
        }
        setCounter(c=>({...c,prices:totalTxs}));

        // Step 3 — Classify
        setStepIdx(3); setProgress01(0.7);
        await sleep(550);

        // Step 4 — Calculate gains
        setStepIdx(4); setProgress01(0.86);
        await sleep(450);

        // Step 5 — Generate report
        setStepIdx(5); setProgress01(0.96);
        await sleep(400);

        setProgress01(1);
        await sleep(180);

        const txList = generateSampleTxs(wallet, year);
        const totals = summarize(txList);
        setResult({ wallet, country, year, txs: txList, totals });
        if (country === "India") setMethod("FIFO");
        setShowTxs(true);
        requestAnimationFrame(() => {
          document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        setPhase("idle");
        toast(`Done · ${txList.length} transactions in ${((performance.now()-t0)/1000).toFixed(1)}s`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      if (msg === "__cancelled__") {
        setPhase("idle");
      } else {
        setErrMsg(msg);
        setPhase("error");
      }
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const resetProgress = () => {
    setPhase("idle");
    setProgress01(0);
    setStepIdx(0);
    setCounter({txs:0,tokens:0,prices:0,total:0});
    setErrMsg("");
  };

  return (
    <div className="min-h-screen">
      <CommandPalette
        onAction={(id) => {
          if (id === "sample")       fillSample();
          if (id === "copy-install") copyInstall();
          if (id === "export")       toast("Report exported (demo)");
        }}
      />
      {/* scroll progress */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-brand-500 via-accent-rose to-accent-peach origin-left z-[60]"
      />

      {/* ============ STICKY NAV ============ */}
      <header className="sticky top-0 z-50 transition-all duration-300 bg-transparent py-5 [html[data-scrolled='true']_&]:bg-bg/95 [html[data-scrolled='true']_&]:border-b [html[data-scrolled='true']_&]:border-line/70 [html[data-scrolled='true']_&]:py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center shadow-soft">
            <Calculator size={18}/>
          </div>
          <span className="font-semibold tracking-tight text-lg">ChainTax</span>
          <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">BETA</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm text-sub">
          <a href="#agent" className="hover:text-ink transition">Product</a>
          <a href="#how" className="hover:text-ink transition">How it works</a>
          <a href="#install" className="hover:text-ink transition">CLI</a>
          <a href="#faq" className="hover:text-ink transition">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={()=>{ const e=new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}); window.dispatchEvent(e); }}
            className="hidden md:inline-flex items-center gap-1.5 h-9 px-2 rounded-lg border border-line bg-white text-[12px] text-sub hover:border-brand-300 transition"
            aria-label="Open command palette"
          >
            <Search size={13}/>
            <kbd className="font-mono text-[10px] bg-bg border border-line rounded px-1">⌘K</kbd>
          </button>
          {/* Auth disabled - uncomment if OAuth configured */}
          {/* <AuthButton /> */}
          <button
            onClick={() => document.getElementById("agent")?.scrollIntoView({ behavior: "smooth" })}
            className="btn-ghost !bg-ink !text-white !border-ink hover:!bg-brand-600 hover:!border-brand-600 hover:!text-white !px-3 sm:!px-4 hidden xs:inline-flex"
          >
            <span className="hidden sm:inline">Get started</span>
            <span className="sm:hidden">Start</span>
            <ArrowRight size={14}/>
          </button>
          <button
            onClick={()=>setMobileNav(o=>!o)}
            className="md:hidden m3-icon-btn !w-10 !h-10 !border !border-line"
            aria-label={mobileNav ? "Close menu" : "Open menu"}
          >
            {mobileNav ? <X size={18}/> : <Menu size={18}/>}
          </button>
        </div>
        </div>
        {/* Mobile menu */}
        <AnimatePresence>
          {mobileNav && (
            <motion.div
              initial={{height:0,opacity:0}}
              animate={{height:"auto",opacity:1}}
              exit={{height:0,opacity:0}}
              transition={{duration:.22,ease:"easeOut"}}
              className="md:hidden overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-3 pb-3 flex flex-col gap-1">
                {[
                  ["Product","#agent"],["Countries","#countries"],
                  ["CLI","#install"],["Security","#privacy"],
                ].map(([label,href])=>(
                  <a key={href} href={href} onClick={()=>setMobileNav(false)}
                    className="px-3 py-3 rounded-xl text-sm font-medium text-ink hover:bg-bg border border-transparent hover:border-line transition">
                    {label}
                  </a>
                ))}
                <button
                  onClick={() => { setMobileNav(false); document.getElementById("agent")?.scrollIntoView({ behavior: "smooth" }); }}
                  className="mt-2 btn-ghost !bg-ink !text-white !border-ink !justify-center"
                >
                  Get started <ArrowRight size={14}/>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative max-w-6xl mx-auto text-center mt-10 sm:mt-14 mb-14 sm:mb-20 px-4 sm:px-6 lg:px-10">
        {/* glow blobs */}
        <div className="pointer-events-none absolute will-change-transform [transform:translateZ(0)] inset-x-0 -top-10 flex justify-center">
          <div className="w-[420px] h-[420px] rounded-full bg-brand-300/30 blur-[80px]"/>
        </div>
        <div className="pointer-events-none absolute will-change-transform [transform:translateZ(0)] -left-10 top-20 w-72 h-72 rounded-full bg-accent-rose/20 blur-[100px]"/>
        <div className="pointer-events-none absolute will-change-transform [transform:translateZ(0)] -right-10 top-10 w-72 h-72 rounded-full bg-accent-peach/20 blur-[100px]"/>

        <div className="relative">
          <span className="pill mx-auto !px-3 !py-1.5 !text-[12px]">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"/>
            New · AI tax agent live in 30+ countries
          </span>

          <h1 className="hero-headline mt-6 text-[44px] xs:text-6xl sm:text-7xl lg:text-[104px] font-extrabold tracking-[-0.035em] leading-[0.95]">
            <span className="block">Crypto taxes,</span>
            <span className="block font-display italic font-normal shimmer-text leading-[1.1] pb-3 mt-1">
              done by an agent.
            </span>
          </h1>

          <p className="mt-7 max-w-2xl mx-auto text-sub text-base sm:text-lg leading-relaxed">
            Paste any wallet. Our agent reads every transaction, applies your
            country&apos;s rules, and produces a <span className="text-ink font-semibold">filing-ready report</span> in seconds.
          </p>

          <div className="mt-8 flex flex-col xs:flex-row items-center justify-center gap-3">
            <a href="#agent" className="btn-ghost !bg-ink !text-white !border-ink hover:!bg-brand-600 hover:!border-brand-600 hover:!text-white !h-12 !px-6 !text-[15px]">
              Start free <ArrowRight size={16}/>
            </a>
            <button onClick={copyInstall} className="btn-ghost !h-12 !px-5 !text-[14px] font-mono">
              {copied ? <Check size={14} className="text-accent-mint"/> : <Terminal size={14}/>}
              {copied ? "copied!" : "$ npx chaintax-skill"}
              <Copy size={12} className="opacity-50"/>
            </button>
          </div>

          {/* social proof row */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8">
            <div className="flex items-center -space-x-2">
              {["us","gb","de","jp","in"].map(c=>(
                // eslint-disable-next-line @next/next/no-img-element
                <img key={c} src={flag(c)} alt="" width={28} height={28} loading="lazy" decoding="async" className="w-7 h-7 rounded-full ring-2 ring-bg" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.visibility='hidden';}}/>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-sub text-sm">
              <div className="flex">
                {[0,1,2,3,4].map(i=>(
                  <Star key={i} size={14} className="fill-accent-peach text-accent-peach"/>
                ))}
              </div>
              <span className="font-semibold text-ink">4.9</span>
              <span>· 12,000+ wallets analyzed</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ BENTO GRID ============ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-12 [grid-auto-rows:minmax(0,auto)] gap-4 sm:gap-5">

        {/* ── Tax Agent (form) ─────────── */}
        <motion.section
          id="agent"
          initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}
          className="scroll-mt-28 bento col-span-12 lg:col-span-7 bg-meshA"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="ico"><Bot size={16}/></span>
              <div>
                <h2 className="font-semibold text-[15px]">Tax Agent</h2>
                <p className="eyebrow mt-0.5">Step 1 · Configure</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runSampleDemo}
                className="hidden sm:inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-brand-50 border border-brand-100 text-[11px] font-bold uppercase tracking-wider text-brand-700 hover:bg-brand-100 transition"
              >
                <Sparkles size={11}/> Run demo
              </button>
              <span className="live hidden sm:inline-flex">demo</span>
            </div>
          </div>

          <div className="relative">
          <AnimatePresence mode="wait">
          {phase === "idle" && (
          <motion.form key="form" onSubmit={onSubmit} className="space-y-4"
            initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            transition={{duration:.25,ease:"easeOut"}}>
            {(() => {
              const trimmed = wallet.trim();
              const detected = detectChain(trimmed);
              const isValid = !!detected;
              const showError = trimmed.length > 0 && !isValid;
              return (
                <div>
                  <label className="label">Wallet address</label>
                  <div className="field">
                    <Wallet size={16} className={`leading ${showError ? "!text-rose-500" : isValid ? "!text-accent-mint" : ""}`}/>
                    <input
                      className={`input font-mono pr-24 ${
                        showError ? "!border-rose-400 focus:!border-rose-500 focus:!shadow-[0_0_0_4px_rgba(244,63,94,.15)]" :
                        isValid   ? "!border-accent-mint focus:!border-accent-mint focus:!shadow-[0_0_0_4px_rgba(95,216,179,.18)]" : ""
                      }`}
                      placeholder="0x… or bc1… or Solana base58"
                      value={wallet}
                      onChange={e=>onWalletChange(e.target.value)}
                      aria-invalid={showError}
                      aria-describedby="wallet-status"
                      required spellCheck={false} autoComplete="off"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {isValid && (
                        <span className="hidden xs:inline-flex items-center gap-1 px-2 h-6 rounded-full bg-accent-mint/15 border border-accent-mint/40 text-[10px] font-bold uppercase tracking-wider text-[#1f7a52]">
                          <Check size={10} strokeWidth={3}/>{detected}
                        </span>
                      )}
                      <button type="button" onClick={pasteFromClipboard}
                        className="m3-icon-btn !w-8 !h-8 !text-sub hover:!text-brand-700"
                        aria-label="Paste from clipboard">
                        <ClipboardPaste size={14}/>
                      </button>
                    </div>
                  </div>
                  <div id="wallet-status" className="min-h-[18px] mt-1.5 text-[11px] flex items-center gap-1.5">
                    {showError && (
                      <span className="text-rose-600 inline-flex items-center gap-1">
                        <X size={11}/>
                        {trimmed.length < 25 ? "Address looks too short" :
                         trimmed.startsWith("0x") ? "Not a valid EVM address (must be 0x + 40 hex chars)" :
                         "Unrecognized address format"}
                      </span>
                    )}
                    {isValid && (
                      <span className="text-[#1f7a52] inline-flex items-center gap-1">
                        <Check size={11} strokeWidth={3}/>
                        Valid {detected} address
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Country</label>
                <Select
                  value={country}
                  onChange={setCountry}
                  options={COUNTRIES.map(c=>({
                    value:c.value,
                    label:c.label,
                    leading:(
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={flag(c.code)} alt="" width={20} height={20} loading="lazy" decoding="async" className="w-5 h-5 rounded-full" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.visibility='hidden';}}/>
                    ),
                  }))}
                  placeholder="Select country"
                  icon={<Globe2 size={16}/>}
                  ariaLabel="Country"
                  searchable
                />
              </div>
              <div>
                <label className="label">Tax year</label>
                <Select
                  value={year}
                  onChange={setYear}
                  options={YEARS}
                  placeholder="Select year"
                  icon={<Calendar size={16}/>}
                  ariaLabel="Tax year"
                />
              </div>
            </div>

            <div>
              <label className="label">Networks</label>
              <div className="flex flex-wrap gap-2">
                {CHAINS.map(c=>{
                  const sel = chains.includes(c.name);
                  return (
                    <button key={c.name} type="button" onClick={()=>toggleChain(c.name)}
                      aria-pressed={sel}
                      className={`chip ${sel?"chip-on":""}`}>
                      <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 transition ${sel ? "bg-white/15" : "bg-bg"}`}>
                        {c.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logo} alt="" loading="lazy" className="chip-logo w-5 h-5 rounded-full ring-1 ring-black/5" onError={(e)=>{const img=e.currentTarget as HTMLImageElement; img.replaceWith(Object.assign(document.createElement('span'),{className:img.className+' grid place-items-center text-[9px] font-extrabold text-white',style:`background:${c.color}`,textContent:c.name[0]}));}}/>
                        ) : (
                          <span
                            className="chip-logo w-5 h-5 rounded-full grid place-items-center text-[9px] font-extrabold text-white ring-1 ring-black/5"
                            style={{background:c.color}}
                          >{c.initial ?? c.name[0]}</span>
                        )}
                      </span>
                      <span className="leading-none">{c.name}</span>
                      {sel && <Check size={12} className="ml-0.5 -mr-0.5 opacity-90"/>}
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              const reason = !wallet.trim()        ? "Enter a wallet to continue"
                            : !detectChain(wallet)  ? "Enter a valid wallet address"
                            : !country              ? "Select a country to continue"
                            : !chains.length        ? "Pick at least one network"
                            : null;
              return (
                <button type="submit" className="btn btn-primary mt-2" disabled={loading || !!reason}>
                  <Zap size={16}/> {reason ?? "Calculate tax"}
                </button>
              );
            })()}
          </motion.form>
          )}

          {phase === "processing" && (
            <motion.div key="processing"
              initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
              transition={{duration:.25,ease:"easeOut"}}>
              <ProgressView
                stepIdx={stepIdx}
                progress01={progress01}
                counter={counter}
                chain={chains[0]||"Ethereum"}
                year={year}
                elapsed={elapsed}
                onCancel={cancelScan}
              />
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div key="error"
              initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
              transition={{duration:.25,ease:"easeOut"}}
              className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 font-mono text-[13px] leading-relaxed">
              <div className="flex items-start gap-3">
                <span className="text-rose-600 text-lg leading-none">✗</span>
                <div className="flex-1 min-w-0">
                  <div className="text-ink font-semibold">{errMsg}</div>
                  <div className="text-sub mt-2">
                    Try a different year, or check the address is correct.
                  </div>
                  <button onClick={resetProgress}
                    className="mt-4 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white border border-line text-ink text-xs font-semibold hover:border-brand-300 hover:text-brand-700 transition">
                    ← Back
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
          </div>
        </motion.section>

        {/* ── Summary ──────────────────── */}
        <motion.section
          initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:.05}}
          className="bento col-span-12 lg:col-span-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="ico !text-accent-rose"><Receipt size={16}/></span>
              <div>
                <h2 className="font-semibold text-[15px]">Summary</h2>
                <p className="eyebrow mt-0.5">Step 2 · Review</p>
              </div>
            </div>
            {result ? (
              <div className="hidden xs:inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full bg-brand-50 border border-brand-100 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-700">
                <span className="truncate max-w-[120px]">{result.country}</span>
                <span className="opacity-40">·</span>
                <div className="flex items-center bg-white/70 rounded-full p-0.5 border border-brand-100">
                  {["2024","2025","2026"].map(y=>{
                    const sel = result.year === y;
                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={()=>{
                          setYear(y);
                          // Regenerate the dataset deterministically for the new year
                          const newTxs = generateSampleTxs(result.wallet, y);
                          setResult({ ...result, year: y, txs: newTxs, totals: summarize(newTxs) });
                          toast(`Switched to ${y}`);
                        }}
                        className={`px-1.5 h-5 rounded-full transition ${
                          sel ? "bg-brand-600 text-white" : "text-brand-700 hover:bg-brand-100"
                        }`}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <span className="hidden xs:inline-flex items-center gap-1.5 h-6 pl-1.5 pr-2.5 rounded-full bg-bg border border-line text-[10px] font-bold uppercase tracking-[0.12em] text-sub">
                <span className="relative w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-sub2 animate-ping opacity-60"/>
                  <span className="absolute inset-0 rounded-full bg-sub2"/>
                </span>
                awaiting input
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {loading && (
              <motion.div key="l" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                className="flex flex-col items-center justify-center py-20 text-sub text-sm gap-3">
                <Loader2 className="animate-spin text-brand-600" size={28}/>
                Reading transactions…
              </motion.div>
            )}

            {!loading && !result && (
              <motion.div key="e" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                className="rounded-2xl border border-dashed border-line dots p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white border border-line grid place-items-center text-brand-600 shadow-soft">
                  <FileText size={20}/>
                </div>
                <p className="text-sm text-sub max-w-xs mx-auto leading-relaxed">
                  Submit a wallet to see your gains, income, and tax owed broken down by your country&apos;s rules.
                </p>
              </motion.div>
            )}

            {!loading && result && (() => {
              try {
              const isIndia = result.country === "India";
              const taxFIFO = estimateTax(result.totals, result.country, "FIFO");
              const taxHIFO = estimateTax(result.totals, result.country, "HIFO");
              const taxAvg  = estimateTax(result.totals, result.country, "Avg");
              const taxNow  = method === "FIFO" ? taxFIFO : method === "HIFO" ? taxHIFO : taxAvg;
              const lowest  = Math.min(taxFIFO.tax, taxHIFO.tax, taxAvg.tax);
              const netTaxable = isIndia ? result.totals.gains : result.totals.netGains;
              const hasIncome = result.totals.airdrops.count > 0 || result.totals.yieldEvents.count > 0;
              return (
              <motion.div key="r" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className="space-y-4">

                {/* Hero tax tile (white number) */}
                <div className="relative rounded-2xl p-5 overflow-hidden bento-dark !p-5">
                  <div className="text-[11px] uppercase tracking-wider opacity-60">Estimated tax due</div>
                  <div className="mt-1 text-4xl font-bold tracking-tight text-white">{fmt(taxNow.tax)}</div>
                  <div className="mt-3 text-xs opacity-60 font-mono truncate">
                    {result.wallet.slice(0,8)}…{result.wallet.slice(-6)}
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-brand-500/30 blur-2xl"/>
                </div>

                {/* Gains / Losses / Net taxable / Income */}
                <div className="grid grid-cols-2 gap-3">
                  <Mini label="Capital gains"
                    value={`+${fmt(result.totals.gains)}`}
                    valueClass="text-gain"
                    icon={<TrendingUp size={14}/>} tint="bg-meshB"
                    tip="Total positive gains from disposals."/>
                  <Mini label="Capital losses"
                    value={`-${fmt(result.totals.losses)}`}
                    valueClass="text-loss"
                    icon={<TrendingDown size={14}/>} tint="bg-meshC"
                    tip="Total losses from disposals."/>
                  <Mini label="Net taxable"
                    value={fmt(netTaxable)}
                    icon={<Gauge size={14}/>} tint="bg-meshD"
                    tip={isIndia ? "India does not allow loss offsets." : "Gains minus losses."}
                    note={isIndia && result.totals.losses > 0 ? "losses not offsettable" : undefined}/>
                  <Mini label="Income"
                    value={fmt(result.totals.income)}
                    icon={<Sparkles size={14}/>} tint="bg-meshA"
                    tip="Airdrops, staking, yield. Often taxed as ordinary income."/>
                </div>

                {/* India TDS card */}
                {isIndia && taxNow.tdsObligation && (
                  <div className="rounded-2xl border border-amber/60 bg-amber/5 p-4 ring-1 ring-amber/20">
                    <div className="text-[11px] uppercase tracking-wider font-bold text-amber">TDS Obligations</div>
                    <div className="mt-1 text-[13px] text-ink font-semibold">
                      {taxNow.tdsObligation.count} transactions over ₹50,000
                    </div>
                    <div className="text-[12px] text-sub">
                      Total TDS to deposit: <span className="font-bold text-ink">₹{taxNow.tdsObligation.total.toLocaleString("en-IN",{maximumFractionDigits:0})}</span> <span className="text-sub">(1%)</span>
                    </div>
                  </div>
                )}

                {/* Cost basis selector */}
                <div className="rounded-2xl border border-line bg-white p-4">
                  <div className="text-[11px] font-semibold text-sub uppercase tracking-wider mb-3">Cost basis method</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["FIFO","HIFO","Avg"] as CostBasisMethod[]).map((m)=>{
                      const t = m==="FIFO"?taxFIFO:m==="HIFO"?taxHIFO:taxAvg;
                      const sel = method === m;
                      const disabled = isIndia && m !== "FIFO";
                      const isLowest = !disabled && t.tax === lowest && [taxFIFO.tax,taxHIFO.tax,taxAvg.tax].filter(x=>x===lowest).length===1;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={()=> !disabled && setMethod(m)}
                          disabled={disabled}
                          aria-pressed={sel}
                          title={disabled ? "India requires FIFO." : `Estimated tax: ${fmt(t.tax)}`}
                          className={`relative rounded-xl border p-3 text-left transition ${
                            disabled ? "opacity-40 cursor-not-allowed bg-bg border-line" :
                            sel ? "border-brand-500 bg-brand-50/60 shadow-soft" : "border-line bg-white hover:border-brand-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-2 min-h-[16px]">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink">
                              <span className={`w-3 h-3 rounded-full border ${sel ? "bg-brand-600 border-brand-600 ring-4 ring-brand-100" : "border-line"}`}/>
                              {m === "Avg" ? "Avg cost" : m}
                            </span>
                            {isLowest && (
                              <span className="inline-flex items-center px-1.5 h-4 rounded text-[9px] bg-gain/15 text-gain font-bold">★ low</span>
                            )}
                          </div>
                          <div className="text-[15px] font-bold tracking-tight font-mono">{fmt(t.tax)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Income events section */}
                {hasIncome && (
                  <div className="rounded-2xl border border-line bg-white p-4">
                    <div className="text-[11px] font-semibold text-sub uppercase tracking-wider mb-3">
                      Income events <span className="text-sub/70 normal-case font-normal">· taxable at slab rate</span>
                    </div>
                    <div className="space-y-1.5 text-[13px]">
                      {result.totals.airdrops.count > 0 && (
                        <div className="flex justify-between">
                          <span className="text-ink">{result.totals.airdrops.count} airdrops received</span>
                          <span className="font-mono font-semibold">{fmt(result.totals.airdrops.total)}</span>
                        </div>
                      )}
                      {result.totals.yieldEvents.count > 0 && (
                        <div className="flex justify-between">
                          <span className="text-ink">{result.totals.yieldEvents.count} yield / interest</span>
                          <span className="font-mono font-semibold">{fmt(result.totals.yieldEvents.total)}</span>
                        </div>
                      )}
                      <div className="border-t border-line my-1"/>
                      <div className="flex justify-between font-bold">
                        <span>Total income</span>
                        <span className="font-mono">{fmt(result.totals.income)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-between text-xs text-sub px-1 pt-1">
                  <span>{result.txs.length} transactions classified</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={()=>setShowTxs(s=>!s)}
                      className="text-brand-700 font-semibold flex items-center gap-1 hover:underline">
                      {showTxs ? "Hide" : "View"} transactions <ChevronRight size={14}/>
                    </button>
                    <button onClick={exportPDF} className="text-brand-700 font-semibold flex items-center gap-1 hover:underline">
                      Export PDF
                    </button>
                    <button onClick={()=>exportCSV()} className="text-brand-700 font-semibold flex items-center gap-1 hover:underline">
                      Export CSV
                    </button>
                  </div>
                </div>
              </motion.div>
              );
              } catch (err) {
                console.error("Summary render error:", err);
                return (
                  <motion.div key="r-err" initial={{opacity:0}} animate={{opacity:1}} className="p-4 bg-rose-50 rounded-xl text-rose-700 text-sm">
                    Error rendering summary. Check console for details.
                  </motion.div>
                );
              }
            })()}
          </AnimatePresence>
        </motion.section>

        {/* ── Transaction table (only after a result) ─────────── */}
        {result && showTxs && (
          <Reveal className="col-span-12">
            <section id="results" className="scroll-mt-28 bento">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className="ico"><Receipt size={16}/></span>
                  <div>
                    <h3 className="font-semibold text-[15px]">Transactions</h3>
                    <p className="eyebrow mt-0.5">{result.txs.length} disposals · {result.country} · {result.year}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={exportPDF} className="btn-ghost !h-9 !text-[12px]">
                    <FileText size={14}/> PDF
                  </button>
                  <button onClick={exportCSV} className="btn-ghost !h-9 !text-[12px]">
                    <Download size={14}/> CSV
                  </button>
                </div>
              </div>
              <TransactionTable txs={result.txs} country={result.country} primaryChain={chains[0]}/>
            </section>
          </Reveal>
        )}

        {/* ── How it works (3 steps) ─────── */}
        <Reveal className="col-span-12">
          <section id="how" className="scroll-mt-28 bento">
            <div className="flex items-center gap-3 mb-6">
              <span className="ico"><Bot size={16}/></span>
              <div>
                <span className="eyebrow">How it works</span>
                <h3 className="font-semibold text-[15px] mt-0.5">Three steps. Twelve seconds.</h3>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { n:"01", t:"Paste a wallet", d:"Any EVM, Bitcoin, or Solana address. We auto-detect the chain.", icon:<Wallet size={16}/> },
                { n:"02", t:"Pick a country", d:"50+ jurisdictions with current tax rules baked in.", icon:<Globe2 size={16}/> },
                { n:"03", t:"Get a filing-ready report", d:"Capital gains, income, TDS, exports — all in one click.", icon:<Receipt size={16}/> },
              ].map((s)=>(
                <div key={s.n} className="relative rounded-2xl border border-line bg-bg/50 p-5">
                  <div className="absolute -top-3 left-5 px-2 py-0.5 rounded-full bg-ink text-white text-[10px] font-bold tracking-wider">
                    STEP {s.n}
                  </div>
                  <span className="inline-grid place-items-center w-9 h-9 rounded-xl bg-white border border-line text-brand-600 mb-3">{s.icon}</span>
                  <div className="font-semibold text-[15px]">{s.t}</div>
                  <p className="text-sm text-sub mt-1.5 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── FAQ ────────────────────────── */}
        <Reveal className="col-span-12">
          <section id="faq" className="scroll-mt-28 bento">
            <div className="flex items-center gap-3 mb-5">
              <span className="ico !text-accent-rose"><Sparkles size={16}/></span>
              <div>
                <span className="eyebrow">Frequently asked</span>
                <h3 className="font-semibold text-[15px] mt-0.5">Things people ask before signing up</h3>
              </div>
            </div>
            <FAQ />
          </section>
        </Reveal>

        {/* ── Install (terminal) ───────── */}
        <Reveal className="col-span-12 lg:col-span-7">
        <section id="install" className="scroll-mt-28 bento-dark h-full">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="ico-dark"><Terminal size={16}/></span>
              <div>
                <h3 className="font-semibold text-[15px]">Run from your terminal</h3>
                <p className="text-[11px] text-white/55 mt-0.5 uppercase tracking-[0.12em]">
                  Same agent · in your CLI
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold">
              CLI · v1.0
            </span>
          </div>

          <div className="rounded-xl bg-black/60 border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"/>
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"/>
                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"/>
              </div>
              <div className="flex items-center gap-1">
                {(["npm","pnpm","yarn","bun"] as Pkg[]).map(p=>(
                  <button key={p} onClick={()=>setPkg(p)}
                    className={`text-[11px] font-mono px-2 py-1 rounded transition ${pkg===p ? "bg-white/15 text-white" : "text-white/45 hover:text-white"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <code className="font-mono text-[13px] sm:text-sm text-white truncate">
                <span className="text-accent-mint select-none">$ </span>{INSTALL_CMDS[pkg]}
              </code>
              <button onClick={copyInstall}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white text-ink text-xs font-semibold hover:bg-bg transition">
                {copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy</>}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["macOS","Linux","Windows","Node ≥ 18"].map(t=>(
              <span key={t} className="text-[11px] text-white/65 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">{t}</span>
            ))}
          </div>
        </section>
        </Reveal>

        {/* ── CTA ──────────────────────── */}
        <Reveal delay={0.05} className="col-span-12 lg:col-span-5">
        <section className="bento bg-meshC h-full">
          <div className="flex items-center gap-3 mb-3">
            <span className="ico !text-accent-peach"><Sparkles size={16}/></span>
            <span className="eyebrow">Get started</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
            File with <span className="font-display italic font-normal text-brand-700">confidence</span>.
          </h3>
          <p className="text-sub text-sm mt-2 mb-5 max-w-sm">
            Let the agent do the boring math. You sign the return.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => document.getElementById("agent")?.scrollIntoView({ behavior: "smooth" })}
              className="btn-ghost !bg-ink !text-white !border-ink hover:!bg-brand-600 hover:!border-brand-600 hover:!text-white"
            >
              Start free <ArrowRight size={14}/>
            </button>
            <button onClick={runSampleDemo} className="btn-ghost">View demo</button>
          </div>
        </section>
        </Reveal>

        {/* ── Countries ────────────────── */}
        <Reveal className="col-span-12 sm:col-span-6 lg:col-span-4">
        <section id="countries" className="scroll-mt-28 bento bg-meshB bento-clip relative min-h-[420px] flex flex-col h-full">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-accent-sky/20 blur-3xl"/>
          <div className="relative flex items-center gap-3 mb-4">
            <span className="ico !text-accent-sky"><Globe2 size={16}/></span>
            <span className="eyebrow">Global coverage</span>
          </div>
          <h3 className="relative text-[44px] font-extrabold tracking-[-0.03em] leading-none">
            30<span className="shimmer-text">+</span>
          </h3>
          <p className="relative text-[15px] text-ink font-semibold mt-1">jurisdictions supported</p>
          <p className="relative text-sm text-sub mt-1 mb-5">Tax rules updated every quarter.</p>
          <div className="relative grid grid-cols-5 gap-2 mt-auto">
            {[
              "us","gb","de","fr","ca",
              "au","in","jp","sg","br",
              "es","it","nl","ch","kr",
            ].map(c=>(
              <div key={c} className="group aspect-square rounded-xl bg-white border border-line shadow-soft flex items-center justify-center hover:border-brand-300 hover:-translate-y-0.5 hover:shadow-cardHover transition">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flag(c)} alt={c} width={24} height={24} loading="lazy" decoding="async" className="w-6 h-6 rounded-full ring-1 ring-line group-hover:scale-110 transition" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.visibility='hidden';}}/>
              </div>
            ))}
            <div className="col-span-5 mt-1 text-[11px] text-sub text-center">+ 15 more countries</div>
          </div>
        </section>
        </Reveal>

        {/* ── Multi-chain ──────────────── */}
        <Reveal delay={0.08} className="col-span-12 sm:col-span-6 lg:col-span-4">
        <section className="bento bg-meshD bento-clip relative min-h-[420px] flex flex-col h-full">
          <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full bg-accent-mint/25 blur-3xl"/>
          <div className="relative flex items-center gap-3 mb-4">
            <span className="ico !text-accent-mint"><Network size={16}/></span>
            <span className="eyebrow">Every chain</span>
          </div>
          <h3 className="relative text-[44px] font-extrabold tracking-[-0.03em] leading-none">
            10<span className="shimmer-text"> chains</span>
          </h3>
          <p className="relative text-[15px] text-ink font-semibold mt-1">EVM, Bitcoin & Solana</p>
          <p className="relative text-sm text-sub mt-1 mb-5">One wallet, one unified report.</p>
          <div className="relative grid grid-cols-5 gap-2 mt-auto">
            {CHAINS.map(c=>(
              <div key={c.name}
                title={c.name}
                className="group aspect-square rounded-xl bg-white border border-line shadow-soft grid place-items-center hover:border-brand-300 hover:-translate-y-0.5 hover:shadow-cardHover transition">
                {c.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logo} alt={c.name} loading="lazy"
                    className="w-7 h-7 rounded-full ring-1 ring-line object-cover group-hover:scale-110 transition"
                    onError={(e)=>{const img=e.currentTarget as HTMLImageElement; img.replaceWith(Object.assign(document.createElement('span'),{className:img.className+' grid place-items-center text-[12px] font-extrabold text-white',style:`background:${c.color}`,textContent:c.name[0]}));}}/>
                ) : (
                  <span
                    className="w-7 h-7 rounded-full ring-1 ring-line grid place-items-center text-[12px] font-extrabold text-white group-hover:scale-110 transition"
                    style={{background:c.color}}
                  >{c.initial ?? c.name[0]}</span>
                )}
              </div>
            ))}
            <div className="col-span-5 mt-1 flex items-center justify-center gap-1.5 text-[11px] text-sub">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"/>
              all networks live
            </div>
          </div>
        </section>
        </Reveal>

        {/* ── Privacy ──────────────────── */}
        <Reveal delay={0.16} className="col-span-12 sm:col-span-12 lg:col-span-4">
        <section id="privacy" className="scroll-mt-28 bento bg-meshA bento-clip relative min-h-[420px] flex flex-col h-full">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accent-lilac/25 blur-3xl"/>
          <div className="relative flex items-center gap-3 mb-4">
            <span className="ico !text-accent-lilac"><Lock size={16}/></span>
            <span className="eyebrow">Privacy-first</span>
          </div>
          <h3 className="relative text-[44px] font-extrabold tracking-[-0.03em] leading-none">
            <span className="shimmer-text">0</span> keys
          </h3>
          <p className="relative text-[15px] text-ink font-semibold mt-1">Read-only by design</p>
          <p className="relative text-sm text-sub mt-1 mb-5">Just a public address. No custody, ever.</p>

          {/* Vault visual */}
          <div className="relative mt-auto rounded-2xl bg-white border border-line shadow-soft p-5 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04] dots"/>
            <div className="relative flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white shadow-soft">
                <ShieldCheck size={18}/>
              </div>
              <div>
                <div className="text-[13px] font-bold leading-tight">Bank-grade security</div>
                <div className="text-[11px] text-sub">Audited by independent firms</div>
              </div>
            </div>
            <div className="relative grid grid-cols-2 gap-2 pt-2 border-t border-line">
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-accent-mint shrink-0"/>
                <span className="text-[12px] font-semibold">SOC 2</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-accent-mint shrink-0"/>
                <span className="text-[12px] font-semibold">GDPR</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-accent-mint shrink-0"/>
                <span className="text-[12px] font-semibold">No tracking</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-accent-mint shrink-0"/>
                <span className="text-[12px] font-semibold">Open source</span>
              </div>
            </div>
          </div>
        </section>
        </Reveal>

        {/* ── Stats strip ──────────────── */}
        <Reveal className="col-span-12">
        <section className="bento">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCount to={12418} suffix="+" label="wallets analyzed"/>
            <StatCount to={50}    suffix="+" label="countries supported"/>
            <StatCount to={84}    prefix="$" suffix="M" label="in gains tracked"/>
            <StatCount to={4.9}   suffix="★" decimals={1} label="user rating"/>
          </div>
        </section>
        </Reveal>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mt-12 sm:mt-16 pb-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sub">
        <span>© 2026 ChainTax. Not legal advice.</span>
        <div className="flex items-center gap-5">
          <a href="#privacy" className="hover:text-ink transition">Privacy</a>
          <a href="#privacy" className="hover:text-ink transition">Terms</a>
          <a href="#faq" className="hover:text-ink transition">FAQ</a>
          <a href="#install" className="hover:text-ink transition">CLI</a>
          <span className="w-px h-4 bg-line"/>
          <a href="https://github.com/chaintax" target="_blank" rel="noopener noreferrer" aria-label="ChainTax on GitHub" className="hover:text-ink transition"><Github size={14}/></a>
        </div>
      </footer>
    </div>
  );
}

/* ----- helpers ----- */

function FAQ() {
  const ITEMS = [
    { q: "Is ChainTax really free?",
      a: "The web app and CLI are free for individuals. We may add a paid tier for accountants, multi-wallet portfolios, and on-chain audit trails — early users get grandfathered." },
    { q: "Do you ever see my private keys?",
      a: "No. We only need a public address. Everything is read-only — we never sign, send, or store anything that touches your funds." },
    { q: "Which countries do you support?",
      a: "50+ jurisdictions with up-to-date rules, including the US, UK, Germany, India (with TDS), Canada, Australia, Singapore, UAE, Brazil, and more. We update tax rules every quarter." },
    { q: "How does cost-basis selection work?",
      a: "Pick FIFO, HIFO, or Average Cost — we recompute the tax estimate live so you can pick the legal method that minimizes what you owe. India is FIFO-only by law." },
    { q: "Can I export to TurboTax / Form 8949?",
      a: "Yes. Click Export CSV from the summary card. We're rolling out TurboTax, Koinly, and IRS Form 8949 native exports next." },
    { q: "What if my wallet has thousands of transactions?",
      a: "The agent streams transactions and prices in parallel. Most 5,000-tx wallets finish in under 30 seconds." },
    { q: "Is this legal advice?",
      a: "No. ChainTax produces estimates and filing-ready breakdowns, but the final return is yours to file. Always verify with a licensed accountant." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line border-y border-line">
      {ITEMS.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q}>
            <button
              type="button"
              onClick={()=>setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 py-4 text-left group"
            >
              <span className={`text-[15px] font-semibold transition ${isOpen ? "text-brand-700" : "text-ink group-hover:text-brand-700"}`}>
                {it.q}
              </span>
              <span className={`shrink-0 w-7 h-7 rounded-full border border-line grid place-items-center transition ${isOpen ? "bg-brand-600 border-brand-600 text-white rotate-45" : "text-sub group-hover:border-brand-300"}`}>
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height:0, opacity:0 }}
                  animate={{ height:"auto", opacity:1 }}
                  exit={{ height:0, opacity:0 }}
                  transition={{ duration:.22, ease:"easeOut" }}
                  className="overflow-hidden"
                >
                  <p className="text-sm text-sub leading-relaxed pb-5 pr-10">{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function Mini({label,value,icon,tint,tip,valueClass,note}:{label:string;value:string;icon:React.ReactNode;tint?:string;tip?:string;valueClass?:string;note?:string}) {
  return (
    <div title={tip} className={`group rounded-2xl border border-line p-4 ${tint??"bg-bg"} shadow-soft cursor-help`}>
      <div className="flex items-center gap-1.5 text-[11px] text-sub uppercase tracking-wider font-semibold">
        <span className="text-brand-600">{icon}</span> {label}
        {tip && <Info size={10} className="opacity-0 group-hover:opacity-60 transition ml-auto"/>}
      </div>
      <div className={`mt-1 font-bold text-lg tracking-tight font-mono ${valueClass ?? ""}`}>{value}</div>
      {note && <div className="text-[10px] text-sub mt-0.5">{note}</div>}
    </div>
  );
}

const STEPS = [
  "Connect to network",
  "Find transactions",
  "Fetching historical prices",
  "Classifying transactions",
  "Calculating gains",
  "Generating report",
];

function ProgressView({
  stepIdx, progress01, counter, chain, year, elapsed, onCancel,
}:{
  stepIdx:number; progress01:number;
  counter:{txs:number;tokens:number;prices:number;total:number};
  chain:string; year:string; elapsed:number; onCancel:()=>void;
}) {
  const pct = Math.round(progress01*100);
  const current = STEPS[stepIdx] ?? STEPS[STEPS.length-1];

  return (
    <div role="status" aria-live="polite" aria-atomic="false" className="rounded-2xl border border-line bg-white p-5 sm:p-6 font-mono text-[13px]">
      {/* header line */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="text-ink font-semibold truncate">{current}…</div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sub tabular-nums">{elapsed.toFixed(1)}s</span>
          <span className="text-sub tabular-nums">{pct}%</span>
          <button onClick={onCancel} className="text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 text-[12px] font-semibold">
            <StopCircle size={13}/> Cancel
          </button>
        </div>
      </div>

      {/* progress bar */}
      <div className="h-2 rounded-full bg-line overflow-hidden mb-5">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-500 via-accent-rose to-accent-peach"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* steps */}
      <ul className="space-y-2">
        {STEPS.map((label,i)=>{
          const done = i < stepIdx;
          const active = i === stepIdx;
          let detail = "";
          if (i===0) detail = `Connected to ${chain}`;
          if (i===1) detail = counter.total ? `Found ${counter.total} transactions (${year})` : "";
          if (i===2 && (active || done)) detail = `prices ${counter.prices}/${counter.total}`;
          return (
            <li key={label} className="flex items-start gap-3">
              <span className={`w-4 text-center select-none ${
                done ? "text-accent-mint" : active ? "text-ink" : "text-sub/50"
              }`}>
                {done ? "✓" : active ? "→" : "○"}
              </span>
              <span className={`flex-1 truncate ${
                done ? "text-sub" : active ? "text-ink font-semibold" : "text-sub/60"
              }`}>
                {done && detail ? detail : label}
                {active && (
                  <span className="ml-1 inline-block w-[7px] h-[14px] align-[-2px] bg-ink animate-pulse"/>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/* live counter */}
      <div className="mt-5 pt-4 border-t border-line text-[12px] text-sub tabular-nums">
        {counter.txs || counter.total || 0} transactions
        {counter.tokens > 0 && <> · {counter.tokens} tokens</>}
        {counter.prices > 0 && counter.prices < counter.total && (
          <> · fetching prices {counter.prices}/{counter.total}</>
        )}
      </div>
    </div>
  );
}

function Stat({n,label}:{n:string;label:string}) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-3xl sm:text-4xl font-bold tracking-tight">
        <span className="shimmer-text">{n}</span>
      </div>
      <div className="text-xs text-sub mt-1">{label}</div>
    </div>
  );
}

function StatCount({to,prefix,suffix,decimals,label}:{to:number;prefix?:string;suffix?:string;decimals?:number;label:string}) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-3xl sm:text-4xl font-bold tracking-tight">
        <span className="shimmer-text">
          <CountUp to={to} prefix={prefix} suffix={suffix} decimals={decimals}/>
        </span>
      </div>
      <div className="text-xs text-sub mt-1">{label}</div>
    </div>
  );
}
