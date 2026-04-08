/**
 * POST /api/fetch
 *
 * Fetches blockchain transactions for a wallet.
 * Body: { wallet: string, chains: string[], year: number }
 * Returns: { txs: RawTx[], tokens: string[], errors: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchWalletTransactions } from "@/lib/fetchers";
import type { RawTx } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 second timeout

type RequestBody = {
  wallet: string;
  chains: string[];
  year: number;
};

type ResponseBody = {
  txs: RawTx[];
  tokens: string[];
  errors: string[];
};

export async function POST(request: NextRequest): Promise<NextResponse<ResponseBody>> {
  try {
    const body = (await request.json()) as RequestBody;

    // Validate input
    if (!body.wallet || typeof body.wallet !== "string") {
      return NextResponse.json(
        { txs: [], tokens: [], errors: ["Missing wallet address"] },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.chains) || body.chains.length === 0) {
      return NextResponse.json(
        { txs: [], tokens: [], errors: ["Missing chains array"] },
        { status: 400 }
      );
    }

    if (!body.year || typeof body.year !== "number") {
      return NextResponse.json(
        { txs: [], tokens: [], errors: ["Missing year"] },
        { status: 400 }
      );
    }

    // Fetch transactions
    const result = await fetchWalletTransactions(
      body.wallet.trim(),
      body.chains,
      body.year
    );

    return NextResponse.json({
      txs: result.txs,
      tokens: Array.from(result.tokens),
      errors: result.errors,
    });
  } catch (err) {
    console.error("Fetch API error:", err);
    return NextResponse.json(
      {
        txs: [],
        tokens: [],
        errors: [err instanceof Error ? err.message : "Internal server error"],
      },
      { status: 500 }
    );
  }
}
