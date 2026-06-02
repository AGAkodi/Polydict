import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch("https://clob.polymarket.com/markets?limit=500", {
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) throw new Error(`CLOB API error: ${res.status}`);

    const raw = await res.json();
    const markets = raw.data ?? raw ?? [];

    const priceMap: Record<string, {
      yes: number;
      no: number;
      vol: number;
      spread: number;
      liquidity: number;
      change1h: number;
    }> = {};

    for (const m of markets) {
      if (!m.condition_id) continue;
      priceMap[m.condition_id] = {
        yes:       parseFloat(m.tokens?.[0]?.price ?? "0.5"),
        no:        parseFloat(m.tokens?.[1]?.price ?? "0.5"),
        vol:       parseFloat(m.volume            ?? "0"),
        spread:    parseFloat(m.spread            ?? "0"),
        liquidity: parseFloat(m.liquidity         ?? "0"),
        change1h:  0,
      };
    }

    return NextResponse.json(priceMap);

  } catch (err: any) {
    console.error("Prices route error:", err);
    return NextResponse.json({}, { status: 500 });
  }
}
