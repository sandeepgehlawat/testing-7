export const flag = (code: string) =>
  `https://hatscripts.github.io/circle-flags/flags/${code}.svg`;

export const chainLogo = (slug: string) =>
  `https://icons.llamao.fi/icons/chains/rsz_${slug}.jpg`;

export type Chain = {
  name: string;
  color: string;
  logo: string;
  initial?: string;
};

export const CHAINS: Chain[] = [
  { name: "Ethereum",  color: "#627eea", logo: chainLogo("ethereum") },
  { name: "Bitcoin",   color: "#f7931a", logo: chainLogo("bitcoin")  },
  { name: "Solana",    color: "#14f195", logo: chainLogo("solana")   },
  { name: "Polygon",   color: "#8247e5", logo: chainLogo("polygon")  },
  { name: "Arbitrum",  color: "#28a0f0", logo: chainLogo("arbitrum") },
  { name: "Base",      color: "#0052ff", logo: chainLogo("base")     },
  { name: "X Layer",   color: "#000000", logo: "https://web3.okx.com/cdn/assets/imgs/254/C86C33BB49D17F5E.png" },
  { name: "Monad",     color: "#6366f1", logo: chainLogo("monad")    },
  { name: "Optimism",  color: "#ff0420", logo: chainLogo("optimism") },
  { name: "Avalanche", color: "#e84142", logo: chainLogo("avalanche")},
];

export type Country = { value: string; label: string; code: string };

export const COUNTRIES: Country[] = [
  { value: "United States",  label: "United States",          code: "us" },
  { value: "United Kingdom", label: "United Kingdom",         code: "gb" },
  { value: "Canada",         label: "Canada",                 code: "ca" },
  { value: "Australia",      label: "Australia",              code: "au" },
  { value: "Germany",        label: "Germany",                code: "de" },
  { value: "France",         label: "France",                 code: "fr" },
  { value: "Spain",          label: "Spain",                  code: "es" },
  { value: "Italy",          label: "Italy",                  code: "it" },
  { value: "Netherlands",    label: "Netherlands",            code: "nl" },
  { value: "Belgium",        label: "Belgium",                code: "be" },
  { value: "Switzerland",    label: "Switzerland",            code: "ch" },
  { value: "Austria",        label: "Austria",                code: "at" },
  { value: "Ireland",        label: "Ireland",                code: "ie" },
  { value: "Portugal",       label: "Portugal",               code: "pt" },
  { value: "Sweden",         label: "Sweden",                 code: "se" },
  { value: "Norway",         label: "Norway",                 code: "no" },
  { value: "Denmark",        label: "Denmark",                code: "dk" },
  { value: "Finland",        label: "Finland",                code: "fi" },
  { value: "Poland",         label: "Poland",                 code: "pl" },
  { value: "Czech Republic", label: "Czech Republic",         code: "cz" },
  { value: "Greece",         label: "Greece",                 code: "gr" },
  { value: "Turkey",         label: "Turkey",                 code: "tr" },
  { value: "UAE",            label: "United Arab Emirates",   code: "ae" },
  { value: "Saudi Arabia",   label: "Saudi Arabia",           code: "sa" },
  { value: "Israel",         label: "Israel",                 code: "il" },
  { value: "South Africa",   label: "South Africa",           code: "za" },
  { value: "Nigeria",        label: "Nigeria",                code: "ng" },
  { value: "Kenya",          label: "Kenya",                  code: "ke" },
  { value: "Egypt",          label: "Egypt",                  code: "eg" },
  { value: "India",          label: "India",                  code: "in" },
  { value: "Pakistan",       label: "Pakistan",               code: "pk" },
  { value: "Bangladesh",     label: "Bangladesh",             code: "bd" },
  { value: "Indonesia",      label: "Indonesia",              code: "id" },
  { value: "Philippines",    label: "Philippines",            code: "ph" },
  { value: "Vietnam",        label: "Vietnam",                code: "vn" },
  { value: "Thailand",       label: "Thailand",               code: "th" },
  { value: "Malaysia",       label: "Malaysia",               code: "my" },
  { value: "Singapore",      label: "Singapore",              code: "sg" },
  { value: "Hong Kong",      label: "Hong Kong",              code: "hk" },
  { value: "Taiwan",         label: "Taiwan",                 code: "tw" },
  { value: "South Korea",    label: "South Korea",            code: "kr" },
  { value: "Japan",          label: "Japan",                  code: "jp" },
  { value: "China",          label: "China",                  code: "cn" },
  { value: "New Zealand",    label: "New Zealand",            code: "nz" },
  { value: "Mexico",         label: "Mexico",                 code: "mx" },
  { value: "Brazil",         label: "Brazil",                 code: "br" },
  { value: "Argentina",      label: "Argentina",              code: "ar" },
  { value: "Chile",          label: "Chile",                  code: "cl" },
  { value: "Colombia",       label: "Colombia",               code: "co" },
  { value: "Peru",           label: "Peru",                   code: "pe" },
];

export const YEARS = ["2026","2025","2024","2023"].map(y=>({value:y,label:y}));

export const STEPS = [
  "Connect to network",
  "Find transactions",
  "Fetching historical prices",
  "Classifying transactions",
  "Calculating gains",
  "Generating report",
];

// Detect chain family from a wallet address prefix
export function detectChain(addr: string): string | null {
  const a = addr.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "Ethereum";
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,}$/.test(a)) return "Bitcoin";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) && !a.startsWith("0x")) return "Solana";
  return null;
}

export const fmt = (n: number) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
