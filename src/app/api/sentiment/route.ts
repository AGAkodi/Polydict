import { grok } from "@/lib/grok";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    const response = await grok.chat.completions.create({
      model: "grok-3-fast",
      messages: [
        {
          role: "system",
          content: `You are a real-time sentiment analyst. Search X (Twitter) and the web for the most recent posts and news about the given prediction market topic from the last 48 hours.

Return ONLY a valid JSON object. No markdown. No explanation. No code fences. Just raw JSON:
{
  "sentiment": "bull",
  "momentum": "rising",
  "topPosts": ["summary of post 1", "summary of post 2", "summary of post 3"],
  "newsHeadlines": ["headline 1", "headline 2"],
  "sentimentScore": 45
}

sentiment must be exactly one of: bull, bear, neutral
momentum must be exactly one of: rising, falling, flat
sentimentScore must be a number between -100 and 100
topPosts must be an array of 3 short strings summarizing real X posts
newsHeadlines must be an array of 2 short news headline strings`
        },
        {
          role: "user",
          content: `Search X and news for recent discussion about this prediction market: "${question}". Return the JSON sentiment analysis.`
        }
      ],
      max_tokens: 600,
      temperature: 0.1,
    });

    const raw = response.choices?.[0]?.message?.content ?? "";
    
    // Strip any markdown fences if present
    const clean = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    // Find JSON object in response even if there is surrounding text
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    const result = {
      sentiment: ["bull", "bear", "neutral"].includes(parsed.sentiment) ? parsed.sentiment : "neutral",
      momentum: ["rising", "falling", "flat"].includes(parsed.momentum) ? parsed.momentum : "flat",
      topPosts: Array.isArray(parsed.topPosts) ? parsed.topPosts.slice(0, 3) : [],
      newsHeadlines: Array.isArray(parsed.newsHeadlines) ? parsed.newsHeadlines.slice(0, 2) : [],
      sentimentScore: typeof parsed.sentimentScore === "number" ? Math.max(-100, Math.min(100, parsed.sentimentScore)) : 0,
    };

    return NextResponse.json(result);

  } catch (err: any) {
    console.error("Sentiment route error:", err?.message ?? err);
    // Return a degraded but valid response instead of erroring
    return NextResponse.json({
      sentiment: "neutral",
      momentum: "flat",
      topPosts: [],
      newsHeadlines: [],
      sentimentScore: 0,
      degraded: true,
    });
  }
}
