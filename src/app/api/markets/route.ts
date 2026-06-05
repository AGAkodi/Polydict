import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB  = "https://clob.polymarket.com";

const TAG_MAP: Record<string, string[]> = {
  politics:  ["Politics", "political", "Government"],
  crypto:    ["Crypto", "Cryptocurrency", "Blockchain", "DeFi", "Bitcoin", "Ethereum"],
  sports:    ["Sports", "NFL", "NBA", "Soccer", "Football", "Basketball", "Tennis", "MMA", "Baseball"],
  science:   ["Science", "Technology", "Space", "Health", "Climate"],
  economics: ["Economics", "Economy", "Markets", "Finance", "Business", "Stock Market"],
  culture:   ["Culture", "Entertainment", "Music", "Movies", "TV", "Celebrities", "Awards", "Pop Culture"],
  world:     ["World", "Global", "International", "News"],
  ai:        ["AI", "Artificial Intelligence", "Machine Learning", "Technology"],
  elections: ["Elections", "Election", "Voting", "Politics", "2024", "2025", "2026"],
  finance:   ["Finance", "Economics", "Markets", "Stocks", "Business"],
};

function flattenEvents(events: any[], category: string, clobMap: Record<string, any>): any[] {
  const markets: any[] = [];
  for (const event of events) {
    for (const market of (event.markets ?? [])) {
      const conditionId = market.conditionId ?? market.condition_id ?? market.id;
      const clob = clobMap[conditionId] ?? {};
      const yesPrice = parseFloat(clob.tokens?.[0]?.price ?? market.outcomePrices?.[0] ?? "0.5");
      const noPrice  = parseFloat(clob.tokens?.[1]?.price ?? market.outcomePrices?.[1] ?? String(1 - yesPrice));
      markets.push({
        id:            conditionId,
        conditionId,
        slug:          market.slug ?? event.slug,
        question:      market.question,
        description:   market.description ?? event.description ?? "",
        category:      event.category ?? event.tags?.[0]?.label ?? event.tags?.[0]?.name ?? category ?? "General",
        tags:          event.tags ?? market.tags ?? [],
        endDate:       market.endDate ?? market.end_date_iso ?? event.endDate,
        endDateIso:    market.end_date_iso ?? market.endDate ?? event.endDate,
        yesPrice,
        noPrice,
        volume:        parseFloat(clob.volume ?? market.volume ?? event.volume ?? "0"),
        liquidity:     parseFloat(clob.liquidity ?? market.liquidity ?? "0"),
        spread:        parseFloat(clob.spread ?? "0"),
        priceChange24h: parseFloat(market.priceChange24h ?? "0"),
        priceChange1h:  parseFloat(market.priceChange1h  ?? "0"),
        sentimentRatio: 0.5,
        sentimentBull:  0,
        sentimentBear:  0,
        active:        market.active ?? true,
        closed:        market.closed ?? false,
        image:         market.image  ?? event.image ?? null,
        clobTokenIds:  clob.tokens?.map((t: any) => t.token_id) ?? [],
        eventTitle:    event.title,
        eventImage:    event.image ?? null,
        eventSlug:     event.slug  ?? null,
      });
    }
  }
  return markets;
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "all";
  const tagValues = category !== "all" ? (TAG_MAP[category.toLowerCase()] ?? [category]) : [];

  try {
    // Step 1 — fetch live prices from CLOB
    const clobRes = await fetch(
      `${CLOB}/sampling-markets?next_cursor=&limit=500`,
      { cache: "no-store" }
    );

    const clobRaw = clobRes.ok ? await clobRes.json() : { data: [] };
    const clobData = clobRaw.data ?? clobRaw ?? [];

    const clobMap: Record<string, any> = {};
    for (const m of clobData) {
      if (m.condition_id) clobMap[m.condition_id] = m;
    }

    let allMarkets: any[] = [];

    if (tagValues.length === 0) {
      // Fetch all markets
      const res = await fetch(
        `${GAMMA}/events?active=true&closed=false&limit=50&order=volume&ascending=false`,
        { next: { revalidate: 86400, tags: ["markets"] } }
      );
      const data = res.ok ? await res.json() : [];
      const events = Array.isArray(data) ? data : data.data ?? [];
      allMarkets = flattenEvents(events, "General", clobMap);
    } else {
      // Try primary tag first
      const primaryTag = tagValues[0];
      const primaryRes = await fetch(
        `${GAMMA}/events?active=true&closed=false&limit=50&order=volume&ascending=false&tag=${encodeURIComponent(primaryTag)}`,
        { next: { revalidate: 86400, tags: ["markets"] } }
      );
      const primaryData = primaryRes.ok ? await primaryRes.json() : [];
      const primaryEvents = Array.isArray(primaryData) ? primaryData : primaryData.data ?? [];
      allMarkets = flattenEvents(primaryEvents, primaryTag, clobMap);

      // If fewer than 5 results, try additional tags and merge
      if (allMarkets.length < 5 && tagValues.length > 1) {
        const additionalFetches = await Promise.allSettled(
          tagValues.slice(1).map((tag) =>
            fetch(
              `${GAMMA}/events?active=true&closed=false&limit=20&order=volume&ascending=false&tag=${encodeURIComponent(tag)}`,
              { next: { revalidate: 86400, tags: ["markets"] } }
            ).then((r) => r.json())
          )
        );

        for (const result of additionalFetches) {
          if (result.status === "fulfilled") {
            const data = Array.isArray(result.value) ? result.value : result.value.data ?? [];
            const additionalMarkets = flattenEvents(data, tagValues[0] ?? category, clobMap);
            // Deduplicate by conditionId
            const existingIds = new Set(allMarkets.map((m: any) => m.conditionId));
            const newMarkets = additionalMarkets.filter((m: any) => !existingIds.has(m.conditionId));
            allMarkets = [...allMarkets, ...newMarkets];
          }
        }
      }
    }

    // Step 2 — client-side category filter
    let filtered = category === "all"
      ? allMarkets
      : allMarkets.filter((m: any) => {
          const cat  = (m.category ?? "").toLowerCase();
          const tags = (m.tags ?? []).map((t: any) =>
            (t.label ?? t.slug ?? "").toLowerCase()
          );
          const target = category.toLowerCase();
          return (
            cat.includes(target) ||
            tags.some((t: string) => t.includes(target))
          );
        });

    // Fallback — fetch top markets and keyword filter if needed
    if (filtered.length < 3 && category !== "all") {
      const fallbackRes = await fetch(
        `${GAMMA}/events?active=true&closed=false&limit=100&order=volume&ascending=false`,
        { cache: "no-store" }
      );
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const fallbackEvents = Array.isArray(fallbackData) ? fallbackData : fallbackData.data ?? [];
        const keywords = TAG_MAP[category.toLowerCase()] ?? [category];
        const keywordFiltered = fallbackEvents.filter((e: any) =>
          keywords.some((kw) =>
            e.title?.toLowerCase().includes(kw.toLowerCase()) ||
            e.tags?.some((t: any) =>
              (t.label ?? t.slug ?? "").toLowerCase().includes(kw.toLowerCase())
            )
          )
        );
        // Flatten and merge with existing filtered markets
        const fallbackMarkets = flattenEvents(keywordFiltered, tagValues[0] ?? category, clobMap);
        const existingIds = new Set(filtered.map((m: any) => m.conditionId));
        const newMarkets = fallbackMarkets.filter((m: any) => !existingIds.has(m.conditionId));
        filtered.push(...newMarkets);
      }
    }

    // Sort by volume descending
    filtered.sort((a: any, b: any) => b.volume - a.volume);

    return NextResponse.json(filtered);

  } catch (err: any) {
    console.error("Markets route error:", err.message);
    return NextResponse.json([], { status: 500 });
  }
}