"use client";

import { useEffect, useRef, useState } from "react";

export function CountUp({
  to,
  prefix = "",
  suffix = "",
  duration = 1400,
  decimals = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
}) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setV(eased * to);
            if (t < 1) requestAnimationFrame(tick);
            else setV(to);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [to, duration]);

  const display = decimals
    ? v.toFixed(decimals)
    : Math.round(v).toLocaleString("en-US");

  return (
    <span ref={ref}>
      {prefix}{display}{suffix}
    </span>
  );
}
