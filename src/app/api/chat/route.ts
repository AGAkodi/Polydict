import { groq } from "@/lib/groq";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { market, analysis, signals, history, message, marketSentiment, allMarkets } = await req.json();

    let systemPrompt = "";

    if (!market) {
      const topMarketsStr = allMarkets && Array.isArray(allMarkets) 
        ? allMarkets.slice(0, 25).map((m: any) => `- ${m.question} | YES: ${(m.yesPrice*100).toFixed(0)}% | Vol: $${Math.round(m.volume).toLocaleString()}`).join("\n")
        : "No live market data available.";

      systemPrompt = `You are ALPHA CAST, a Polymarket analyst with access to live market data.
The user may ask about any market, or ask for general recommendations (e.g. what to ape in).
Here are the current top trending markets on Polymarket right now:
${topMarketsStr}

Always cite specific numbers from the provided list. If they ask for a recommendation, recommend 1 or 2 markets with interesting odds or high edge.
Tone: direct, confident, no filler. Trader talking to a trader.`;
    } else {
      systemPrompt = `You are ALPHA CAST, a sharp prediction market analyst inside a live Polymarket tool.
Every answer must reference specific numbers from the context below. Never give generic answers.

--- LIVE MARKET ---
Question: "${market.question}"
Category: ${market.category}
YES price: ${(market.yesPrice * 100).toFixed(1)}%
NO price: ${(market.noPrice * 100).toFixed(1)}%
Volume: ${market.volume}
Ends: ${market.endDate}
Description: ${market.description ?? "N/A"}

--- OUR ANALYSIS ---
Verdict: ${analysis?.verdict ?? "SKIP"}
Confidence: ${(analysis?.confidence ? analysis.confidence * 100 : 50).toFixed(1)}%
Edge: ${(analysis?.edge ? analysis.edge * 100 : 0).toFixed(1)} percentage point
Summary: ${analysis?.summary ?? "N/A"}
Reasoning: ${analysis?.reasoning ?? "N/A"}
Key risk: ${analysis?.risk ?? "N/A"}

--- SOCIAL SIGNALS ---
Sentiment: ${signals?.sentiment ?? "unavailable"}
Momentum: ${signals?.momentum ?? "unavailable"}
Key posts: ${signals?.keyPosts?.join(" | ") ?? "none"}
Breaking news: ${signals?.breakingNews?.join(" | ") ?? "none"}

--- POLYMARKET CROWD DATA ---
24h trend: ${marketSentiment?.trend ?? "unknown"}
Crowd sentiment: ${marketSentiment?.polymarketSentiment ? (marketSentiment.polymarketSentiment.bullVolume / Math.max(marketSentiment.polymarketSentiment.bullVolume + marketSentiment.polymarketSentiment.bearVolume, 1) * 100).toFixed(0) + "% bullish" : "unavailable"}
24h price change: ${marketSentiment?.polymarketSentiment?.change24h ? (marketSentiment.polymarketSentiment.change24h * 100).toFixed(1) + "pp" : "unavailable"}
Liquidity: ${marketSentiment?.polymarketSentiment?.liquidity ?? "unavailable"}
---

RESPONSE RULES:
- Maximum 3 sentences for every answer. No exceptions.
- If the answer needs more than 3 sentences, give the 3 most important ones only.
- Always include one specific number from the market context in every reply.
- No bullet points. No headers. No long explanations. Plain direct sentences only.
- End with one sharp follow-up question on a new line.
- Tone: trader talking to a trader. Zero filler words.`;
    }

    const messages: { role: "user" | "assistant"; content: string }[] = [
      {
        role: "user",
        content: "Context loaded. Ready.",
      },
      {
        role: "assistant",
        content: market
          ? `Got it. "${market.question}" is at ${(market.yesPrice * 100).toFixed(1)}% YES. Verdict: ${analysis?.verdict ?? "SKIP"} - ${(analysis?.confidence ? analysis.confidence * 100 : 50).toFixed(1)}% confidence, ${(analysis?.edge ? analysis.edge * 100 : 0).toFixed(1)} percentage point edge. Ask me anything.`
          : "Global analyst desk ready. Ask me about any market.",
      },
      ...(history || []).map((h: any) => ({
        role: h.role === "user" ? ("user" as const) : ("assistant" as const),
        content: h.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const reply = response.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json(
        { error: "No response from Groq" },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });

  } catch (err: any) {
    console.error("Error in /api/chat route:", err);
    return NextResponse.json(
      { error: err.message || "Chat failed" },
      { status: 500 }
    );
  }
}