import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans",
});
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  display: "swap",
  variable: "--font-display",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://chaintax.app"),
  title: {
    default: "ChainTax — AI Crypto Tax Agent",
    template: "%s · ChainTax",
  },
  description:
    "Paste any wallet. Our AI agent reads every transaction, applies your country's tax rules, and produces a filing-ready report in seconds. 50+ countries, 10 chains.",
  keywords: [
    "crypto tax", "bitcoin tax", "ethereum tax", "wallet tax calculator",
    "AI tax agent", "chain tax", "DeFi tax", "capital gains crypto",
  ],
  authors: [{ name: "ChainTax" }],
  openGraph: {
    type: "website",
    title: "ChainTax — Crypto taxes, done by an agent.",
    description:
      "Paste a wallet. Our agent does the rest. 50+ countries, 10 chains, filing-ready reports.",
    siteName: "ChainTax",
    locale: "en_US",
    url: "https://chaintax.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChainTax — Crypto taxes, done by an agent.",
    description: "Paste a wallet. The AI agent handles every chain and every country.",
    creator: "@chaintax",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://chaintax.app" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <link rel="preconnect" href="https://hatscripts.github.io" crossOrigin="" />
        <link rel="preconnect" href="https://icons.llamao.fi" crossOrigin="" />
        <link rel="preconnect" href="https://web3.okx.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://raw.githubusercontent.com" />
      </head>
      <body className="font-sans">
        <SmoothScroll />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
