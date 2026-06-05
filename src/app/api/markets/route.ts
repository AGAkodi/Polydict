import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB  = "https://clob.polymarket.com";

const TAG_MAP: Record<string, string> = {
  politics:  "Politics",
  crypto:    "Crypto",
  sports:    "Sports",
  science:   "Science",
  economics: "Economics",
  economy:   "Economics",
  culture:   "Culture",
  world:     "World",
  ai:        "AI",
  elections: "Elections",
  finance:   "Finance",
};

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "all";
  const tagValue = category !== "all" ? TAG_MAP[category.toLowerCase()] : null;
  const tagParam = tagValue ? `&tag=${encodeURIComponent(tagValue)}` : "";

  try {
    // Step 1 — fetch events from Gamma Events API
    const eventsUrl = `${GAMMA}/events?active=true&closed=false&limit=50&order=volume&ascending=false${tagParam}`;
    const eventsRes = await fetch(eventsUrl, {
      next: { revalidate: 86400, tags: ["markets"] },
    });

    if (!eventsRes.ok) {
      throw new Error(`Gamma Events API error: ${eventsRes.status}`);
    }

    const events = await eventsRes.json();
    const eventsArray = Array.isArray(events) ? events : events.data ?? [];

    if (eventsArray.length === 0) {
      console.log(`[Events API Category Empty] category: ${category}, url: ${eventsUrl}, raw response:`, JSON.stringify(events));
    }

    // Step 2 — fetch live prices from CLOB
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

    // Step 3 — flatten events into individual markets
    const markets: any[] = [];

    for (const event of eventsArray) {
      const eventMarkets = event.markets ?? [];

      for (const market of eventMarkets) {
        const conditionId = market.conditionId ?? market.condition_id ?? market.id;
        const clob = clobMap[conditionId] ?? {};

        // YES/NO prices — CLOB first, Gamma fallback
        const yesPrice = parseFloat(
          clob.tokens?.[0]?.price ??
          market.outcomePrices?.[0] ??
          "0.5"
        );
        const noPrice = parseFloat(
          clob.tokens?.[1]?.price ??
          market.outcomePrices?.[1] ??
          String(1 - yesPrice)
        );

        const volume = parseFloat(
          clob.volume ?? market.volume ?? event.volume ?? "0"
        );

        const liquidity = parseFloat(clob.liquidity ?? market.liquidity ?? "0");
        const spread    = parseFloat(clob.spread    ?? "0");

        markets.push({
          id:            conditionId,
          conditionId,
          slug:          market.slug ?? event.slug,
          question:      market.question,
          description:   market.description ?? event.description ?? "",
          category:      event.category ?? event.tags?.[0]?.label ?? event.tags?.[0]?.name ?? tagValue ?? "General",
          tags:          event.tags ?? market.tags ?? [],
          endDate:       market.endDate ?? market.end_date_iso ?? event.endDate,
          endDateIso:    market.end_date_iso ?? market.endDate ?? event.endDate,
          yesPrice,
          noPrice,
          volume,
          liquidity,
          spread,
          priceChange24h: parseFloat(market.priceChange24h ?? "0"),
          priceChange1h:  parseFloat(market.priceChange1h  ?? "0"),
          sentimentRatio: 0.5,
          sentimentBull:  0,
          sentimentBear:  0,
          active:         market.active  ?? true,
          closed:         market.closed  ?? false,
          image:          market.image   ?? event.image ?? null,
          clobTokenIds:   clob.tokens?.map((t: any) => t.token_id) ?? [],
          eventTitle:     event.title,
          eventImage:     event.image  ?? null,
          eventSlug:      event.slug   ?? null,
        });
      }
    }

    // Step 4 — client-side category safety filter as backstop
    const filtered = category === "all"
      ? markets
      : markets.filter((m: any) => {
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

    // Sort by volume descending
    filtered.sort((a: any, b: any) => b.volume - a.volume);

    return NextResponse.json(filtered);

  } catch (err: any) {
    console.error("Markets route error:", err.message);
    return NextResponse.json([], { status: 500 });
  }
}