"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string; hint?: string; leading?: React.ReactNode };

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  icon,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Sync active index when opening
  useEffect(() => {
    if (open) {
      const i = options.findIndex((o) => o.value === value);
      setActive(i >= 0 ? i : 0);
    }
  }, [open, value, options]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const opt = options[active];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={`group w-full h-12 bg-white border rounded-xl
          pl-11 pr-10 text-left text-[15px] outline-none transition-all
          flex items-center
          ${open ? "border-brand-500 shadow-ringBrand" : "border-line hover:border-brand-200"}`}
      >
        {selected?.leading ? (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center pointer-events-none">
            {selected.leading}
          </span>
        ) : icon ? (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sub pointer-events-none">
            {icon}
          </span>
        ) : null}
        <span className={selected ? "text-ink truncate" : "text-sub/70 truncate"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-sub transition-transform ${open ? "rotate-180 text-brand-600" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="absolute z-50 mt-2 w-full rounded-2xl bg-white border border-line shadow-cardHover overflow-hidden"
          >
            <ul
              ref={listRef}
              role="listbox"
              className="max-h-64 overflow-y-auto p-1.5 scroll-smooth"
            >
              {options.map((o, i) => {
                const isSel = o.value === value;
                const isAct = i === active;
                return (
                  <li key={o.value} role="option" aria-selected={isSel}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] text-left transition
                        ${isAct ? "bg-brand-50 text-brand-800" : "text-ink"}
                        ${isSel ? "font-semibold" : ""}`}
                    >
                      {o.leading && (
                        <span className="w-5 h-5 grid place-items-center shrink-0">{o.leading}</span>
                      )}
                      <span className="truncate flex-1">{o.label}</span>
                      {isSel && <Check size={16} className="text-brand-600 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
