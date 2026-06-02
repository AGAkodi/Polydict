import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const conditionId = req.nextUrl.searchParams.get("conditionId");
  const slug = req.nextUrl.searchParams.get("slug");

  if (!conditionId && !slug) {
    return NextResponse.json({ error: "conditionId or slug required" }, { status: 400 });
  }

  try {
    const identifier = conditionId ?? slug;

    // Fetch price history from Data API
    const [historyRes, marketRes] = await Promise.allSettled([
      fetch(
        `https://data-api.polymarket.com/prices-history?market=${identifier}&interval=1d&fidelity=60`,
        { cache: "no-store" }
      ),
      fetch(
        `https://data-api.polymarket.com/markets/${identifier}`,
        { cache: "no-store" }
      ),
    ]);

    const history = historyRes.status === "fulfilled" && historyRes.value.ok
      ? await historyRes.value.json() : null;

    const marketData = marketRes.status === "fulfilled" && marketRes.value.ok
      ? await marketRes.value.json() : null;

    // Calculate price trend from history
    let trend: "rising" | "falling" | "flat" = "flat";
    let pricePoints: { t: number; p: number }[] = [];

    if (history?.history && Array.isArray(history.history)) {
      pricePoints = history.history.map((h: any) => ({
        t: h.t,
        p: parseFloat(h.p),
      }));

      if (pricePoints.length >= 2) {
        const first = pricePoints[0].p;
        const last  = pricePoints[pricePoints.length - 1].p;
        const diff  = last - first;
        if (diff > 0.02)       trend = "rising";
        else if (diff < -0.02) trend = "falling";
        else                   trend = "flat";
      }
    }

    // Polymarket sentiment — bullish/bearish split from market data
    const polymarketSentiment = {
      bullVolume:  parseFloat(marketData?.volumeBull    ?? marketData?.liquidityBull ?? "0"),
      bearVolume:  parseFloat(marketData?.volumeBear    ?? marketData?.liquidityBear ?? "0"),
      totalVolume: parseFloat(marketData?.volume        ?? "0"),
      change24h:   parseFloat(marketData?.priceChange24h ?? "0"),
      change1h:    parseFloat(marketData?.priceChange1h  ?? "0"),
      lastPrice:   parseFloat(marketData?.lastTradePrice ?? "0.5"),
      liquidity:   parseFloat(marketData?.liquidity      ?? "0"),
    };

    return NextResponse.json({
      trend,
      priceHistory: pricePoints,
      polymarketSentiment,
      raw: marketData,
    });

  } catch (err: any) {
    console.error("Market sentiment route error:", err);
    return NextResponse.json({
      trend: "flat",
      priceHistory: [],
      polymarketSentiment: null,
      error: err.message,
    });
  }
}
