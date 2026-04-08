"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import {
  Calculator, Wallet, Globe2, Calendar, Zap, Sparkles, ArrowRight,
  TrendingUp, ShieldCheck, Bot, FileText, Network, Lock, Loader2,
  Gauge, Coins, Receipt, ChevronRight, Github, Twitter,
  Terminal, Copy, Check, Star,
} from "lucide-react";
import { Select } from "@/components/Select";

const INSTALL_CMD = "npx chaintax-skill install";

const CHAINS = [
  { name: "Ethereum", color: "#627eea" },
  { name: "Bitcoin",  color: "#f7931a" },
  { name: "Solana",   color: "#14f195" },
  { name: "Polygon",  color: "#8247e5" },
  { name: "Arbitrum", color: "#28a0f0" },
  { name: "Base",     color: "#0052ff" },
];
const flag = (code: string) =>
  `https://hatscripts.github.io/circle-flags/flags/${code}.svg`;

const COUNTRIES = [
  { value: "United States",  label: "United States",  code: "us" },
  { value: "United Kingdom", label: "United Kingdom", code: "gb" },
  { value: "Germany",        label: "Germany",        code: "de" },
  { value: "France",         label: "France",         code: "fr" },
  { value: "Canada",         label: "Canada",         code: "ca" },
  { value: "Australia",      label: "Australia",      code: "au" },
  { value: "India",          label: "India",          code: "in" },
  { value: "Japan",          label: "Japan",          code: "jp" },
  { value: "Singapore",      label: "Singapore",      code: "sg" },
  { value: "Nigeria",        label: "Nigeria",        code: "ng" },
];
const YEARS = ["2026","2025","2024","2023"].map(y=>({value:y,label:y}));

const fmt = (n:number) => "$" + n.toLocaleString("en-US",{maximumFractionDigits:0});

type Result = {
  wallet:string; country:string; year:string; txs:number;
  proceeds:number; cost:number; gains:number; income:number; tax:number;
};

export default function Home() {
  const [wallet,setWallet] = useState("");
  const [country,setCountry] = useState("");
  const [year,setYear] = useState("2025");
  const [chains,setChains] = useState<string[]>(["Ethereum","Base"]);
  const [loading,setLoading] = useState(false);
  const [result,setResult] = useState<Result|null>(null);
  const [copied,setCopied] = useState(false);
  const [scrolled,setScrolled] = useState(false);

  // scroll progress bar
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 25, mass: 0.3 });

  // shrink/blur nav after scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const copyInstall = async () => {
    try { await navigator.clipboard.writeText(INSTALL_CMD); } catch {}
    setCopied(true);
    setTimeout(()=>setCopied(false),1800);
  };

  const toggleChain = (c:string) =>
    setChains(p => p.includes(c) ? p.filter(x=>x!==c) : [...p,c]);

  const onSubmit = async (e:React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setResult(null);
    await new Promise(r=>setTimeout(r,1400));
    const proceeds = Math.random()*80000+5000;
    const cost = proceeds*(0.5+Math.random()*0.3);
    const gains = proceeds-cost;
    const income = Math.random()*4000;
    const rate = country==="Germany"?0:country==="United States"?0.22:0.20;
    const tax = Math.max(0,gains*rate)+income*rate;
    setResult({wallet,country,year,txs:Math.floor(Math.random()*400+30),proceeds,cost,gains,income,tax});
    setLoading(false);
  };

  return (
    <div className="min-h-screen">
      {/* scroll progress */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-brand-500 via-accent-rose to-accent-peach origin-left z-[60]"
      />

      {/* ============ STICKY NAV ============ */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-bg/75 backdrop-blur-xl border-b border-line/70 py-3"
            : "bg-transparent py-5"
        }`}
      >
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
          <a href="#countries" className="hover:text-ink transition">Countries</a>
          <a href="#install" className="hover:text-ink transition">CLI</a>
          <a href="#privacy" className="hover:text-ink transition">Security</a>
        </nav>
        <div className="flex items-center gap-2">
          <button className="btn-ghost hidden md:inline-flex">Sign in</button>
          <button className="btn-ghost !bg-ink !text-white !border-ink hover:!bg-brand-600 hover:!border-brand-600 hover:!text-white !px-3 sm:!px-4">
            <span className="hidden xs:inline">Get started</span>
            <span className="xs:hidden">Start</span>
            <ArrowRight size={14}/>
          </button>
        </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative max-w-6xl mx-auto text-center mt-10 sm:mt-14 mb-14 sm:mb-20 px-4 sm:px-6 lg:px-10">
        {/* glow blobs */}
        <div className="pointer-events-none absolute inset-x-0 -top-10 flex justify-center">
          <div className="w-[520px] h-[520px] rounded-full bg-brand-300/30 blur-[120px]"/>
        </div>
        <div className="pointer-events-none absolute -left-10 top-20 w-72 h-72 rounded-full bg-accent-rose/20 blur-[100px]"/>
        <div className="pointer-events-none absolute -right-10 top-10 w-72 h-72 rounded-full bg-accent-peach/20 blur-[100px]"/>

        <div className="relative">
          <span className="pill mx-auto !px-3 !py-1.5 !text-[12px]">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"/>
            New · AI tax agent live in 30+ countries
          </span>

          <h1 className="mt-6 text-[44px] xs:text-6xl sm:text-7xl lg:text-[104px] font-extrabold tracking-[-0.035em] leading-[0.95]">
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
            <button className="btn-ghost !bg-ink !text-white !border-ink hover:!bg-brand-600 hover:!border-brand-600 hover:!text-white !h-12 !px-6 !text-[15px]">
              Start free <ArrowRight size={16}/>
            </button>
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
                <img key={c} src={flag(c)} alt="" className="w-7 h-7 rounded-full ring-2 ring-bg"/>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-12 gap-4 sm:gap-5">

        {/* ── Tax Agent (form) ─────────── */}
        <motion.section
          id="agent"
          initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}
          className="scroll-mt-28 bento col-span-12 lg:col-span-7 lg:row-span-2 bg-meshA"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="ico"><Bot size={16}/></span>
              <div>
                <h2 className="font-semibold text-[15px]">Tax Agent</h2>
                <p className="eyebrow mt-0.5">Step 1 · Configure</p>
              </div>
            </div>
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-sub">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"/> live
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Wallet address</label>
              <div className="field">
                <Wallet size={16} className="leading"/>
                <input className="input font-mono" placeholder="0x… or bc1…"
                  value={wallet} onChange={e=>setWallet(e.target.value)} required/>
              </div>
            </div>

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
                      <img src={flag(c.code)} alt="" className="w-5 h-5 rounded-full"/>
                    ),
                  }))}
                  placeholder="Select country"
                  icon={<Globe2 size={16}/>}
                  ariaLabel="Country"
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
                      className={`chip ${sel?"chip-on":""}`}>
                      <span className="w-2 h-2 rounded-full" style={{background:c.color}}/>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>}
              {loading ? "Scanning wallet…" : "Calculate tax"}
            </button>
          </form>
        </motion.section>

        {/* ── Summary ──────────────────── */}
        <motion.section
          initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:.05}}
          className="bento col-span-12 lg:col-span-5 lg:row-span-2"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="ico !text-accent-rose"><Receipt size={16}/></span>
              <div>
                <h2 className="font-semibold text-[15px]">Summary</h2>
                <p className="eyebrow mt-0.5">Step 2 · Review</p>
              </div>
            </div>
            <span className="text-[11px] text-sub">
              {result ? `${result.country} · ${result.year}` : "awaiting input"}
            </span>
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

            {!loading && result && (
              <motion.div key="r" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className="space-y-4">
                <div className="relative rounded-2xl p-5 overflow-hidden bento-dark !p-5">
                  <div className="text-[11px] uppercase tracking-wider opacity-60">Estimated tax owed</div>
                  <div className="mt-1 text-4xl font-bold tracking-tight">{fmt(result.tax)}</div>
                  <div className="mt-3 text-xs opacity-60 font-mono truncate">
                    {result.wallet.slice(0,8)}…{result.wallet.slice(-6)}
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-brand-500/30 blur-2xl"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Mini label="Proceeds" value={fmt(result.proceeds)} icon={<TrendingUp size={14}/>} tint="bg-meshB"/>
                  <Mini label="Cost basis" value={fmt(result.cost)} icon={<Coins size={14}/>} tint="bg-meshC"/>
                  <Mini label="Gains" value={fmt(result.gains)} icon={<Gauge size={14}/>} tint="bg-meshD"/>
                  <Mini label="Income" value={fmt(result.income)} icon={<Sparkles size={14}/>} tint="bg-meshA"/>
                </div>
                <div className="flex items-center justify-between text-xs text-sub px-1 pt-1">
                  <span>{result.txs} transactions classified</span>
                  <button className="text-brand-700 font-semibold flex items-center gap-1 hover:underline">
                    Export PDF <ChevronRight size={14}/>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

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

          <div className="rounded-xl bg-black/60 border border-white/10 overflow-hidden backdrop-blur">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"/>
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"/>
                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"/>
              </div>
              <span className="text-[11px] text-white/40 font-mono">~ /chaintax</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <code className="font-mono text-[13px] sm:text-sm text-white truncate">
                <span className="text-accent-mint select-none">$ </span>{INSTALL_CMD}
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
            <button className="btn-ghost !bg-ink !text-white !border-ink hover:!bg-brand-600 hover:!border-brand-600 hover:!text-white">
              Start free <ArrowRight size={14}/>
            </button>
            <button className="btn-ghost">View demo</button>
          </div>
        </section>
        </Reveal>

        {/* ── Countries ────────────────── */}
        <Reveal className="col-span-12 sm:col-span-6 lg:col-span-4">
        <section id="countries" className="scroll-mt-28 bento bg-meshB bento-clip relative min-h-[340px] flex flex-col h-full">
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
          <div className="relative grid grid-cols-6 gap-2 mt-auto">
            {[
              "us","gb","de","fr","ca","au",
              "in","jp","sg","ng","br","mx",
              "es","it","nl","ch","se","ae",
              "kr","za","pt","ie","nz","pl",
            ].map(c=>(
              <div key={c} className="group aspect-square rounded-xl bg-white border border-line shadow-soft flex items-center justify-center hover:border-brand-300 hover:-translate-y-0.5 hover:shadow-cardHover transition">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flag(c)} alt={c} className="w-6 h-6 rounded-full ring-1 ring-line group-hover:scale-110 transition"/>
              </div>
            ))}
            <div className="aspect-square rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-[11px] font-bold text-brand-700">
              +6
            </div>
          </div>
        </section>
        </Reveal>

        {/* ── Multi-chain ──────────────── */}
        <Reveal delay={0.08} className="col-span-12 sm:col-span-6 lg:col-span-4">
        <section className="bento bg-meshD bento-clip relative min-h-[340px] flex flex-col h-full">
          <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full bg-accent-mint/25 blur-3xl"/>
          <div className="relative flex items-center gap-3 mb-4">
            <span className="ico !text-accent-mint"><Network size={16}/></span>
            <span className="eyebrow">Every chain</span>
          </div>
          <h3 className="relative text-[44px] font-extrabold tracking-[-0.03em] leading-none">
            6<span className="shimmer-text"> chains</span>
          </h3>
          <p className="relative text-[15px] text-ink font-semibold mt-1">EVM, Bitcoin & Solana</p>
          <p className="relative text-sm text-sub mt-1 mb-5">One wallet, one unified report.</p>
          <div className="relative grid grid-cols-2 gap-2 mt-auto">
            {CHAINS.map(c=>(
              <div key={c.name}
                className="group relative rounded-xl bg-white border border-line shadow-soft px-3 py-3 hover:border-brand-300 hover:-translate-y-0.5 hover:shadow-cardHover transition overflow-hidden">
                <div
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{background:`linear-gradient(90deg, ${c.color}, ${c.color}00)`}}
                />
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-7 h-7 rounded-lg grid place-items-center text-white text-[11px] font-bold shrink-0 shadow-soft"
                    style={{background:c.color}}
                  >
                    {c.name[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold leading-tight truncate">{c.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"/>
                      <span className="text-[10px] uppercase tracking-wider text-sub font-semibold">live</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        </Reveal>

        {/* ── Privacy ──────────────────── */}
        <Reveal delay={0.16} className="col-span-12 sm:col-span-12 lg:col-span-4">
        <section id="privacy" className="scroll-mt-28 bento bg-meshA bento-clip relative min-h-[340px] flex flex-col h-full">
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
            <Stat n="12k+"  label="wallets analyzed"/>
            <Stat n="30+"   label="countries supported"/>
            <Stat n="$84M"  label="in gains tracked"/>
            <Stat n="4.9★"  label="user rating"/>
          </div>
        </section>
        </Reveal>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 mt-12 sm:mt-16 pb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sub">
        <span>© 2026 ChainTax. Not legal advice.</span>
        <div className="flex items-center gap-3">
          <a href="#" className="hover:text-ink transition"><Twitter size={14}/></a>
          <a href="#" className="hover:text-ink transition"><Github size={14}/></a>
        </div>
      </footer>
    </div>
  );
}

/* ----- helpers ----- */

function Mini({label,value,icon,tint}:{label:string;value:string;icon:React.ReactNode;tint?:string}) {
  return (
    <div className={`rounded-2xl border border-line p-4 ${tint??"bg-bg"} shadow-soft`}>
      <div className="flex items-center gap-1.5 text-[11px] text-sub uppercase tracking-wider font-semibold">
        <span className="text-brand-600">{icon}</span> {label}
      </div>
      <div className="mt-1 font-bold text-lg tracking-tight">{value}</div>
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
