/**
 * CoinGecko Historical Price Service
 *
 * Fetches historical prices for tokens with batching and caching.
 * Free tier: 10K calls/month, 30/min rate limit.
 */

import type { PricePoint, PriceRequest } from "./types";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const COINGECKO_PRO_BASE = "https://pro-api.coingecko.com/api/v3";

// Rate limiting
const RATE_LIMIT_DELAY = 2100; // 2.1 seconds between calls (30/min = 2s)
let lastCallTime = 0;

// In-memory cache for server
const priceCache = new Map<string, number>(); // "tokenId:date" -> price

/**
 * Fetch historical prices for a list of requests
 */
export async function fetchHistoricalPrices(
  requests: PriceRequest[]
): Promise<PricePoint[]> {
  const results: PricePoint[] = [];
  const toFetch: PriceRequest[] = [];

  // Check cache first
  for (const req of requests) {
    const cacheKey = `${req.tokenId}:${req.date}`;
    const cached = priceCache.get(cacheKey);

    if (cached !== undefined) {
      results.push({
        tokenId: req.tokenId,
        date: req.date,
        priceUsd: cached,
      });
    } else {
      toFetch.push(req);
    }
  }

  // Group by token ID for efficient fetching
  const byToken = new Map<string, string[]>();
  for (const req of toFetch) {
    if (!byToken.has(req.tokenId)) {
      byToken.set(req.tokenId, []);
    }
    byToken.get(req.tokenId)!.push(req.date);
  }

  // Fetch each token's history
  for (const [tokenId, dates] of byToken) {
    try {
      const prices = await fetchTokenHistory(tokenId, dates);

      for (const [date, price] of Object.entries(prices)) {
        const cacheKey = `${tokenId}:${date}`;
        priceCache.set(cacheKey, price);

        results.push({
          tokenId,
          date,
          priceUsd: price,
        });
      }
    } catch (err) {
      console.error(`Failed to fetch prices for ${tokenId}:`, err);
      // Return 0 for failed lookups
      for (const date of dates) {
        results.push({
          tokenId,
          date,
          priceUsd: 0,
        });
      }
    }
  }

  return results;
}

/**
 * Fetch price history for a single token
 */
async function fetchTokenHistory(
  tokenId: string,
  dates: string[]
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};

  // Sort dates to find range
  const sortedDates = [...dates].sort();
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];

  // Convert to timestamps
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate).getTime() / 1000) + 86400; // +1 day

  // Rate limiting
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - timeSinceLastCall);
  }

  // Fetch market chart data
  const apiKey = process.env.COINGECKO_API_KEY;
  const baseUrl = apiKey ? COINGECKO_PRO_BASE : COINGECKO_BASE;

  const url = new URL(`${baseUrl}/coins/${tokenId}/market_chart/range`);
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("from", String(startTs));
  url.searchParams.set("to", String(endTs));

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey) {
    headers["x-cg-pro-api-key"] = apiKey;
  }

  lastCallTime = Date.now();

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - wait and retry once
      await sleep(60000); // Wait 1 minute
      return fetchTokenHistory(tokenId, dates);
    }
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    prices: [number, number][]; // [timestamp_ms, price]
  };

  // Build a map of date -> price
  const pricesByDate = new Map<string, number>();

  for (const [tsMs, price] of data.prices) {
    const date = new Date(tsMs).toISOString().split("T")[0];
    // Use the first price of each day (or could average)
    if (!pricesByDate.has(date)) {
      pricesByDate.set(date, price);
    }
  }

  // Map requested dates to prices
  for (const date of dates) {
    const price = pricesByDate.get(date);
    if (price !== undefined) {
      results[date] = price;
    } else {
      // Find nearest date
      const nearest = findNearestDate(date, Array.from(pricesByDate.keys()));
      if (nearest) {
        results[date] = pricesByDate.get(nearest)!;
      } else {
        results[date] = 0;
      }
    }
  }

  return results;
}

/**
 * Fetch single historical price (simpler API)
 */
export async function fetchHistoricalPrice(
  tokenId: string,
  date: string
): Promise<number> {
  const cacheKey = `${tokenId}:${date}`;
  const cached = priceCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // Rate limiting
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - timeSinceLastCall);
  }

  const apiKey = process.env.COINGECKO_API_KEY;
  const baseUrl = apiKey ? COINGECKO_PRO_BASE : COINGECKO_BASE;

  // Format date as DD-MM-YYYY for CoinGecko
  const [year, month, day] = date.split("-");
  const cgDate = `${day}-${month}-${year}`;

  const url = `${baseUrl}/coins/${tokenId}/history?date=${cgDate}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey) {
    headers["x-cg-pro-api-key"] = apiKey;
  }

  lastCallTime = Date.now();

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 429) {
      await sleep(60000);
      return fetchHistoricalPrice(tokenId, date);
    }
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    market_data?: {
      current_price?: {
        usd?: number;
      };
    };
  };

  const price = data.market_data?.current_price?.usd ?? 0;
  priceCache.set(cacheKey, price);

  return price;
}

/**
 * Find the nearest date in a list to a target date
 */
function findNearestDate(target: string, dates: string[]): string | null {
  if (dates.length === 0) return null;

  const targetTs = new Date(target).getTime();
  let nearest = dates[0];
  let nearestDiff = Math.abs(new Date(dates[0]).getTime() - targetTs);

  for (const date of dates) {
    const diff = Math.abs(new Date(date).getTime() - targetTs);
    if (diff < nearestDiff) {
      nearest = date;
      nearestDiff = diff;
    }
  }

  return nearest;
}

/**
 * Clear the price cache
 */
export function clearPriceCache(): void {
  priceCache.clear();
}

/**
 * Get cached price if available
 */
export function getCachedPrice(tokenId: string, date: string): number | null {
  const cacheKey = `${tokenId}:${date}`;
  return priceCache.get(cacheKey) ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
