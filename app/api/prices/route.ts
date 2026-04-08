/**
 * POST /api/prices
 *
 * Fetches historical prices for tokens.
 * Body: { requests: { tokenId: string, date: string }[] }
 * Returns: { prices: { [key: string]: number }, errors: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchHistoricalPrices } from "@/lib/prices";
import type { PriceRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minute timeout for price fetching

type RequestBody = {
  requests: PriceRequest[];
};

type ResponseBody = {
  prices: Record<string, number>; // "tokenId:date" -> price
  errors: string[];
};

export async function POST(request: NextRequest): Promise<NextResponse<ResponseBody>> {
  try {
    const body = (await request.json()) as RequestBody;

    // Validate input
    if (!Array.isArray(body.requests)) {
      return NextResponse.json(
        { prices: {}, errors: ["Missing requests array"] },
        { status: 400 }
      );
    }

    // Limit batch size
    const MAX_REQUESTS = 500;
    if (body.requests.length > MAX_REQUESTS) {
      return NextResponse.json(
        { prices: {}, errors: [`Maximum ${MAX_REQUESTS} price requests per call`] },
        { status: 400 }
      );
    }

    // Fetch prices
    const results = await fetchHistoricalPrices(body.requests);

    // Convert to key-value format
    const prices: Record<string, number> = {};
    for (const result of results) {
      prices[`${result.tokenId}:${result.date}`] = result.priceUsd;
    }

    return NextResponse.json({
      prices,
      errors: [],
    });
  } catch (err) {
    console.error("Prices API error:", err);
    return NextResponse.json(
      {
        prices: {},
        errors: [err instanceof Error ? err.message : "Internal server error"],
      },
      { status: 500 }
    );
  }
}
