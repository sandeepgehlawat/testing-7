/**
 * Token ID Resolution
 *
 * Maps token addresses to CoinGecko IDs for price lookups.
 * Includes built-in mapping for top tokens across chains.
 */

export type TokenMapping = {
  address: string;      // Lowercase contract address
  chain: string;        // Chain name
  symbol: string;       // Token symbol
  coingeckoId: string;  // CoinGecko ID for price lookups
  decimals: number;
};

// Native tokens (address is 0x0 or chain-specific)
const NATIVE_TOKENS: TokenMapping[] = [
  { address: "0x0000000000000000000000000000000000000000", chain: "Ethereum", symbol: "ETH", coingeckoId: "ethereum", decimals: 18 },
  { address: "0x0000000000000000000000000000000000000000", chain: "Polygon", symbol: "MATIC", coingeckoId: "matic-network", decimals: 18 },
  { address: "0x0000000000000000000000000000000000000000", chain: "Arbitrum", symbol: "ETH", coingeckoId: "ethereum", decimals: 18 },
  { address: "0x0000000000000000000000000000000000000000", chain: "Base", symbol: "ETH", coingeckoId: "ethereum", decimals: 18 },
  { address: "0x0000000000000000000000000000000000000000", chain: "Optimism", symbol: "ETH", coingeckoId: "ethereum", decimals: 18 },
  { address: "0x0000000000000000000000000000000000000000", chain: "Bitcoin", symbol: "BTC", coingeckoId: "bitcoin", decimals: 8 },
  { address: "so11111111111111111111111111111111111111112", chain: "Solana", symbol: "SOL", coingeckoId: "solana", decimals: 9 },
];

// Top ERC-20 tokens on Ethereum (with addresses on other chains)
const ERC20_TOKENS: TokenMapping[] = [
  // Stablecoins
  { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", chain: "Ethereum", symbol: "USDC", coingeckoId: "usd-coin", decimals: 6 },
  { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", chain: "Ethereum", symbol: "USDT", coingeckoId: "tether", decimals: 6 },
  { address: "0x6b175474e89094c44da98b954eedeac495271d0f", chain: "Ethereum", symbol: "DAI", coingeckoId: "dai", decimals: 18 },
  { address: "0x4fabb145d64652a948d72533023f6e7a623c7c53", chain: "Ethereum", symbol: "BUSD", coingeckoId: "binance-usd", decimals: 18 },
  { address: "0x853d955acef822db058eb8505911ed77f175b99e", chain: "Ethereum", symbol: "FRAX", coingeckoId: "frax", decimals: 18 },

  // Wrapped tokens
  { address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", chain: "Ethereum", symbol: "WETH", coingeckoId: "weth", decimals: 18 },
  { address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", chain: "Ethereum", symbol: "WBTC", coingeckoId: "wrapped-bitcoin", decimals: 8 },

  // DeFi tokens
  { address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", chain: "Ethereum", symbol: "UNI", coingeckoId: "uniswap", decimals: 18 },
  { address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", chain: "Ethereum", symbol: "AAVE", coingeckoId: "aave", decimals: 18 },
  { address: "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", chain: "Ethereum", symbol: "MKR", coingeckoId: "maker", decimals: 18 },
  { address: "0xc00e94cb662c3520282e6f5717214004a7f26888", chain: "Ethereum", symbol: "COMP", coingeckoId: "compound-governance-token", decimals: 18 },
  { address: "0xd533a949740bb3306d119cc777fa900ba034cd52", chain: "Ethereum", symbol: "CRV", coingeckoId: "curve-dao-token", decimals: 18 },
  { address: "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2", chain: "Ethereum", symbol: "SUSHI", coingeckoId: "sushi", decimals: 18 },
  { address: "0xba100000625a3754423978a60c9317c58a424e3d", chain: "Ethereum", symbol: "BAL", coingeckoId: "balancer", decimals: 18 },
  { address: "0x111111111117dc0aa78b770fa6a738034120c302", chain: "Ethereum", symbol: "1INCH", coingeckoId: "1inch", decimals: 18 },

  // Other major tokens
  { address: "0x514910771af9ca656af840dff83e8264ecf986ca", chain: "Ethereum", symbol: "LINK", coingeckoId: "chainlink", decimals: 18 },
  { address: "0x75231f58b43240c9718dd58b4967c5114342a86c", chain: "Ethereum", symbol: "OKB", coingeckoId: "okb", decimals: 18 },
  { address: "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", chain: "Ethereum", symbol: "SHIB", coingeckoId: "shiba-inu", decimals: 18 },
  { address: "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39", chain: "Ethereum", symbol: "HEX", coingeckoId: "hex", decimals: 8 },
  { address: "0x4d224452801aced8b2f0aebe155379bb5d594381", chain: "Ethereum", symbol: "APE", coingeckoId: "apecoin", decimals: 18 },
  { address: "0x582d872a1b094fc48f5de31d3b73f2d9be47def1", chain: "Ethereum", symbol: "TON", coingeckoId: "the-open-network", decimals: 9 },

  // LSD tokens
  { address: "0xae78736cd615f374d3085123a210448e74fc6393", chain: "Ethereum", symbol: "rETH", coingeckoId: "rocket-pool-eth", decimals: 18 },
  { address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", chain: "Ethereum", symbol: "stETH", coingeckoId: "staked-ether", decimals: 18 },
  { address: "0xbe9895146f7af43049ca1c1ae358b0541ea49704", chain: "Ethereum", symbol: "cbETH", coingeckoId: "coinbase-wrapped-staked-eth", decimals: 18 },

  // L2 tokens
  { address: "0x912ce59144191c1204e64559fe8253a0e49e6548", chain: "Arbitrum", symbol: "ARB", coingeckoId: "arbitrum", decimals: 18 },
  { address: "0x4200000000000000000000000000000000000042", chain: "Optimism", symbol: "OP", coingeckoId: "optimism", decimals: 18 },

  // Meme coins
  { address: "0x6982508145454ce325ddbe47a25d4ec3d2311933", chain: "Ethereum", symbol: "PEPE", coingeckoId: "pepe", decimals: 18 },
  { address: "0xb131f4a55907b10d1f0a50d8ab8fa09ec342cd74", chain: "Ethereum", symbol: "MEME", coingeckoId: "memecoin", decimals: 18 },
];

// Polygon tokens
const POLYGON_TOKENS: TokenMapping[] = [
  { address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", chain: "Polygon", symbol: "WMATIC", coingeckoId: "wmatic", decimals: 18 },
  { address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", chain: "Polygon", symbol: "USDC", coingeckoId: "usd-coin", decimals: 6 },
  { address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", chain: "Polygon", symbol: "USDT", coingeckoId: "tether", decimals: 6 },
  { address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", chain: "Polygon", symbol: "WETH", coingeckoId: "weth", decimals: 18 },
];

// Solana tokens
const SOLANA_TOKENS: TokenMapping[] = [
  { address: "epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v", chain: "Solana", symbol: "USDC", coingeckoId: "usd-coin", decimals: 6 },
  { address: "es9vmfrzacermjfrf4h2fyd4kconky11mcce8benwnyb", chain: "Solana", symbol: "USDT", coingeckoId: "tether", decimals: 6 },
  { address: "dezxaz8z7pnrnrjjz3wxborgixca6xjnb7yab1ppb263", chain: "Solana", symbol: "BONK", coingeckoId: "bonk", decimals: 5 },
  { address: "jupyiwryjfskupihA7hkeR8VUtAeFoSYbKedZNsDvCN", chain: "Solana", symbol: "JUP", coingeckoId: "jupiter-exchange-solana", decimals: 6 },
  { address: "msolzycxhdygdzu16g5qsh3i5k3z3kzk7ytfqcjm7so", chain: "Solana", symbol: "mSOL", coingeckoId: "msol", decimals: 9 },
  { address: "7vfcxtux5wjv5jadK17DUJ4ksgau7utNKj4b963voxs", chain: "Solana", symbol: "WETH", coingeckoId: "weth", decimals: 8 },
];

// Combine all tokens
const ALL_TOKENS: TokenMapping[] = [
  ...NATIVE_TOKENS,
  ...ERC20_TOKENS,
  ...POLYGON_TOKENS,
  ...SOLANA_TOKENS,
];

// Build lookup maps
const ADDRESS_TO_COINGECKO = new Map<string, string>();
const SYMBOL_TO_COINGECKO = new Map<string, string>();

for (const token of ALL_TOKENS) {
  // Address lookup (chain-specific key)
  const key = `${token.chain.toLowerCase()}:${token.address.toLowerCase()}`;
  ADDRESS_TO_COINGECKO.set(key, token.coingeckoId);

  // Also store just by address for convenience
  ADDRESS_TO_COINGECKO.set(token.address.toLowerCase(), token.coingeckoId);

  // Symbol lookup (use first match)
  if (!SYMBOL_TO_COINGECKO.has(token.symbol.toLowerCase())) {
    SYMBOL_TO_COINGECKO.set(token.symbol.toLowerCase(), token.coingeckoId);
  }
}

/**
 * Get CoinGecko ID for a token address
 */
export function getCoingeckoId(address: string, chain?: string): string | null {
  const addr = address.toLowerCase();

  // Try chain-specific lookup first
  if (chain) {
    const key = `${chain.toLowerCase()}:${addr}`;
    const id = ADDRESS_TO_COINGECKO.get(key);
    if (id) return id;
  }

  // Fall back to address-only lookup
  return ADDRESS_TO_COINGECKO.get(addr) ?? null;
}

/**
 * Get CoinGecko ID for a token symbol
 */
export function getCoingeckoIdBySymbol(symbol: string): string | null {
  return SYMBOL_TO_COINGECKO.get(symbol.toLowerCase()) ?? null;
}

/**
 * Build a mapping from token addresses to CoinGecko IDs
 * for a set of addresses
 */
export function buildTokenMapping(
  addresses: string[],
  chain?: string
): Map<string, string> {
  const mapping = new Map<string, string>();

  for (const addr of addresses) {
    const id = getCoingeckoId(addr, chain);
    if (id) {
      mapping.set(addr.toLowerCase(), id);
    }
  }

  return mapping;
}

/**
 * Get all known tokens
 */
export function getAllTokens(): TokenMapping[] {
  return ALL_TOKENS;
}

// Export for direct usage
export { ALL_TOKENS, ADDRESS_TO_COINGECKO, SYMBOL_TO_COINGECKO };
