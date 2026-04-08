"use client";

import { useEffect } from "react";

export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    const start = async () => {
      if (cancelled) return;
      const { default: Lenis } = await import("lenis");
      if (cancelled) return;

      const lenis = new Lenis({
        lerp: 0.2,
        smoothWheel: true,
        wheelMultiplier: 1.1,
        touchMultiplier: 1.8,
        syncTouch: false,
      });

      let raf = 0;
      const loop = (t: number) => {
        lenis.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement)?.closest?.("a[href^='#']") as HTMLAnchorElement | null;
        if (!a || a.dataset.noLenis !== undefined) return;
        const href = a.getAttribute("href");
        if (!href || href === "#" || href.length < 2) return;
        const el = document.getElementById(href.slice(1));
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -72 });
      };
      document.addEventListener("click", onClick);

      // Pause when tab is hidden
      const onVis = () => {
        if (document.hidden) cancelAnimationFrame(raf);
        else raf = requestAnimationFrame(loop);
      };
      document.addEventListener("visibilitychange", onVis);

      cleanup = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("click", onClick);
        document.removeEventListener("visibilitychange", onVis);
        lenis.destroy();
      };
    };

    // Defer until the browser is idle so Lenis isn't in the critical path
    const ric = (window as Window & typeof globalThis & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) ric(start, { timeout: 1500 });
    else setTimeout(start, 800);

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
