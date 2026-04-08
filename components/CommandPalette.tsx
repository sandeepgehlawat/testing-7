"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowRight, Globe2, Terminal, Lock, Bot, Receipt, Sparkles, CornerDownLeft,
} from "lucide-react";

type Cmd = {
  id: string;
  title: string;
  group: string;
  icon: React.ReactNode;
  hint?: string;
  run: () => void;
};

export function CommandPalette({ onAction }: { onAction?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const commands: Cmd[] = useMemo(
    () => [
      { id: "go-agent",     group: "Navigate", title: "Tax Agent",    icon: <Bot size={15}/>,      run: () => jump("#agent") },
      { id: "go-countries", group: "Navigate", title: "Countries",    icon: <Globe2 size={15}/>,   run: () => jump("#countries") },
      { id: "go-install",   group: "Navigate", title: "Install CLI",  icon: <Terminal size={15}/>, run: () => jump("#install") },
      { id: "go-privacy",   group: "Navigate", title: "Privacy",      icon: <Lock size={15}/>,     run: () => jump("#privacy") },
      { id: "sample",       group: "Actions",  title: "Try sample wallet (vitalik.eth)", icon: <Sparkles size={15}/>, hint: "0xd8dA…6045", run: () => onAction?.("sample") },
      { id: "copy-install", group: "Actions",  title: "Copy install command",            icon: <Terminal size={15}/>, run: () => onAction?.("copy-install") },
      { id: "export",       group: "Actions",  title: "Export PDF report",               icon: <Receipt size={15}/>,  run: () => onAction?.("export") },
    ],
    [onAction]
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return commands;
    const s = q.toLowerCase();
    return commands.filter((c) => c.title.toLowerCase().includes(s) || c.group.toLowerCase().includes(s));
  }, [commands, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { setActive(0); }, [q, open]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
      setOpen(false);
    }
  };

  function jump(hash: string) {
    setOpen(false);
    setTimeout(() => {
      const el = document.querySelector(hash);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[18vh] bg-ink/30 backdrop-blur-sm px-4"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ y: -12, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -12, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-white border border-line shadow-cardHover overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
              <Search size={16} className="text-sub" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onListKey}
                placeholder="Type a command or search…"
                className="flex-1 bg-transparent outline-none text-[15px] placeholder-sub/60"
              />
              <kbd className="text-[10px] font-semibold text-sub bg-bg border border-line rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-sub">No results</li>
              )}
              {filtered.map((c, i) => (
                <li key={c.id}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => { c.run(); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
                      i === active ? "bg-brand-50 text-brand-800" : "text-ink"
                    }`}
                  >
                    <span className="text-brand-600">{c.icon}</span>
                    <span className="flex-1 text-[14px] truncate">{c.title}</span>
                    {c.hint && <span className="text-[11px] font-mono text-sub">{c.hint}</span>}
                    <span className="text-[10px] uppercase font-semibold text-sub">{c.group}</span>
                    {i === active && <CornerDownLeft size={13} className="text-sub"/>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between px-4 py-2 border-t border-line text-[11px] text-sub">
              <span>↑↓ navigate · ↵ select</span>
              <span className="flex items-center gap-1">
                <kbd className="bg-bg border border-line rounded px-1">⌘</kbd>
                <kbd className="bg-bg border border-line rounded px-1">K</kbd>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
