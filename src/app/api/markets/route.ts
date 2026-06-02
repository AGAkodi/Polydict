import { NextRequest, NextResponse } from "next/server";
import { classifyMarket } from "../../../utils/polymarket";

export const dynamic = "force-dynamic";

const GAMMA = "https://gamma-api.polymarket.com";
const DATA  = "https://data-api.polymarket.com";
const CLOB  = "https://clob.polymarket.com";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "all";

  try {
    // 1. Gamma — metadata + tags
    const tagParam = category !== "all" ? `&tag_slug=${category}` : "";
    const gammaUrl = `${GAMMA}/markets?active=true&closed=false&limit=100&order=volume&ascending=false${tagParam}`;

    // 2. CLOB — live orderbook prices
    const clobUrl = `${CLOB}/markets?next_cursor=&limit=100`;

    // 3. Data API — volume history and sentiment
    const dataUrl = `${DATA}/markets?limit=100&offset=0`;

    const [gammaRes, clobRes, dataRes] = await Promise.allSettled([
      fetch(gammaUrl, { cache: "no-store" }),
      fetch(clobUrl,  { cache: "no-store" }),
      fetch(dataUrl,  { cache: "no-store" }),
    ]);

    const gammaData = gammaRes.status === "fulfilled" && gammaRes.value.ok
      ? await gammaRes.value.json() : [];

    const clobRaw = clobRes.status === "fulfilled" && clobRes.value.ok
      ? await clobRes.value.json() : { data: [] };
    const clobData = clobRaw.data ?? clobRaw ?? [];

    const dataRaw = dataRes.status === "fulfilled" && dataRes.value.ok
      ? await dataRes.value.json() : [];
    const dataData = Array.isArray(dataRaw) ? dataRaw : dataRaw.data ?? [];

    // Build lookup maps
    const clobMap: Record<string, any> = {};
    for (const m of clobData) {
      if (m.condition_id) clobMap[m.condition_id] = m;
      if (m.market_slug)  clobMap[m.market_slug]  = m;
    }

    const dataMap: Record<string, any> = {};
    for (const m of dataData) {
      if (m.conditionId) dataMap[m.conditionId] = m;
      if (m.slug)        dataMap[m.slug]        = m;
    }

    // Merge
    const merged = (Array.isArray(gammaData) ? gammaData : []).map((m: any) => {
      const clob = clobMap[m.conditionId] ?? clobMap[m.slug] ?? {};
      const data = dataMap[m.conditionId] ?? dataMap[m.slug] ?? {};

      // YES/NO prices from CLOB orderbook
      const yesPrice = parseFloat(
        clob.tokens?.[0]?.price ??
        m.outcomePrices?.[0] ??
        "0.5"
      );
      const noPrice = parseFloat(
        clob.tokens?.[1]?.price ??
        m.outcomePrices?.[1] ??
        String(1 - yesPrice)
      );

      // Volume from Data API or Gamma fallback
      const volume = parseFloat(
        data.volume ?? clob.volume ?? m.volume ?? "0"
      );

      // Price change from Data API
      const priceChange24h = parseFloat(data.priceChange24h ?? "0");
      const priceChange1h  = parseFloat(data.priceChange1h  ?? "0");

      // Liquidity from CLOB
      const liquidity = parseFloat(clob.liquidity ?? "0");
      const spread    = parseFloat(clob.spread    ?? "0");

      // Market sentiment from Data API
      const sentimentBull = parseFloat(data.liquidityBull ?? data.volumeBull ?? "0");
      const sentimentBear = parseFloat(data.liquidityBear ?? data.volumeBear ?? "0");
      const sentimentRatio = sentimentBull + sentimentBear > 0
        ? sentimentBull / (sentimentBull + sentimentBear)
        : 0.5;

      return {
        id:           m.id ?? m.conditionId,
        conditionId:  m.conditionId ?? m.id,
        slug:         m.slug,
        question:     m.question,
        description:  m.description ?? "",
        category:     classifyMarket(m),
        tags:         m.tags ?? [],
        endDate:      m.endDate ?? m.end_date_iso,
        yesPrice,
        noPrice,
        volume,
        liquidity,
        spread,
        priceChange24h,
        priceChange1h,
        sentimentRatio,
        sentimentBull,
        sentimentBear,
        active:       m.active ?? true,
        closed:       m.closed ?? false,
        image:        m.image ?? null,
        clobTokenIds: clob.tokens?.map((t: any) => t.token_id) ?? [],
      };
    });

    // Client-side category safety filter
    const filtered = category === "all"
      ? merged
      : merged.filter((m: any) =>
          m.category?.toLowerCase().includes(category.toLowerCase()) ||
          m.tags?.some((t: any) =>
            t.slug?.toLowerCase() === category.toLowerCase() ||
            t.label?.toLowerCase().includes(category.toLowerCase())
          )
        );

    return NextResponse.json(filtered);

  } catch (err: any) {
    console.error("Markets route error:", err);
    return NextResponse.json([], { status: 500 });
  }
}