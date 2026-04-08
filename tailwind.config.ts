import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    screens: {
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', "system-ui", "sans-serif"],
        display: ['var(--font-display)', 'var(--font-sans)', "serif"],
        mono: ['var(--font-mono)', "ui-monospace", "monospace"],
      },
      colors: {
        // cohesive premium palette — indigo/violet base
        ink: "#0a0a1a",
        ink2: "#1a1a2e",
        sub: "#6b6b85",
        sub2: "#9a9ab0",
        line: "#ececf3",
        line2: "#f2f2f7",
        bg: "#fafafc",
        card: "#ffffff",
        brand: {
          50:  "#f3f2ff",
          100: "#e9e7ff",
          200: "#d4d0ff",
          300: "#b3acff",
          400: "#8c80ff",
          500: "#6c5cf5",
          600: "#5b46e8",
          700: "#4a35c8",
          800: "#3b2aa0",
          900: "#2a1f72",
        },
        accent: {
          rose:  "#ff6b9d",
          peach: "#ffb088",
          mint:  "#5fd8b3",
          sky:   "#7cc4ff",
          lilac: "#c8a8ff",
        },
        gain: "#0fab7a",   // slightly muted from #10b981
        loss: "#e25555",   // slightly muted from #ef4444
        amber: "#f59e0b",
      },
      boxShadow: {
        card: "0 1px 0 rgba(15,15,40,.04), 0 1px 2px rgba(15,15,40,.04), 0 12px 32px -16px rgba(15,15,40,.10)",
        cardHover: "0 1px 0 rgba(15,15,40,.06), 0 2px 4px rgba(15,15,40,.06), 0 24px 48px -18px rgba(91,70,232,.18)",
        soft: "0 1px 2px rgba(15,15,40,.06)",
        ringBrand: "0 0 0 4px rgba(108,92,245,.15)",
      },
      borderRadius: {
        bento: "1.5rem",
      },
      backgroundImage: {
        // unified mesh gradients — all from same indigo/rose/peach family
        meshA: "radial-gradient(140% 100% at 0% 0%, #f3f2ff 0%, transparent 55%), radial-gradient(120% 80% at 100% 100%, #ffeef4 0%, transparent 55%)",
        meshB: "radial-gradient(140% 100% at 100% 0%, #eef9ff 0%, transparent 55%), radial-gradient(120% 80% at 0% 100%, #f3f2ff 0%, transparent 55%)",
        meshC: "radial-gradient(140% 100% at 50% 0%, #fff4ec 0%, transparent 55%), radial-gradient(120% 80% at 100% 100%, #f3f2ff 0%, transparent 50%)",
        meshD: "radial-gradient(140% 100% at 0% 100%, #ecfff5 0%, transparent 55%), radial-gradient(120% 80% at 100% 0%, #f3f2ff 0%, transparent 55%)",
        gridDots: "radial-gradient(circle, rgba(108,92,245,.10) 1px, transparent 1px)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        floaty:  { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-4px)" } },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        floaty:  "floaty 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
