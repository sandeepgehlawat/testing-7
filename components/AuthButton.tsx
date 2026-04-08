"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, LogOut, User, ChevronDown, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function AuthButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [open]);

  if (status === "loading") {
    return (
      <button className="btn-ghost !h-9 !px-3 opacity-50 cursor-wait" disabled>
        <Loader2 size={14} className="animate-spin" />
      </button>
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn()}
        className="btn-ghost !h-9 !px-3.5 !text-[13px]"
      >
        <LogIn size={14} />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost !h-9 !pl-2 !pr-2.5 !gap-2"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {session.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="w-6 h-6 rounded-full ring-1 ring-line"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-brand-100 grid place-items-center">
            <User size={12} className="text-brand-700" />
          </div>
        )}
        <span className="hidden sm:inline text-[13px] font-medium truncate max-w-[100px]">
          {session.user?.name?.split(" ")[0] ?? "Account"}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-line bg-white shadow-lg overflow-hidden z-50"
            role="menu"
          >
            <div className="px-4 py-3 border-b border-line">
              <div className="text-[13px] font-semibold text-ink truncate">
                {session.user?.name ?? "User"}
              </div>
              <div className="text-[11px] text-sub truncate">
                {session.user?.email ?? ""}
              </div>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="w-full px-4 py-2.5 text-left text-[13px] text-ink hover:bg-bg flex items-center gap-2.5 transition"
                role="menuitem"
              >
                <LogOut size={14} className="text-sub" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
