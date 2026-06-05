import { grok } from "@/lib/grok";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question) {
      return NextResponse.json({ error: "No question" }, { status: 400 });
    }

    const response = await grok.chat.completions.create({
      model: "grok-3-fast",
      messages: [
        {
          role: "system",
          content: `You are a real-time sentiment analyst. Search X (Twitter) and the web for recent posts and news about the given prediction market topic from the last 48 hours.

You MUST respond with ONLY a raw JSON object. No markdown. No explanation. No code fences. No text before or after. Start your response with { and end with }.

The JSON must have exactly these fields:
{
  "sentiment": "bull",
  "momentum": "rising",
  "topPosts": ["summary 1", "summary 2", "summary 3"],
  "newsHeadlines": ["headline 1", "headline 2"],
  "sentimentScore": 45
}

sentiment: must be exactly one of bull, bear, neutral
momentum: must be exactly one of rising, falling, flat
topPosts: array of exactly 3 short strings each under 20 words
newsHeadlines: array of exactly 2 short strings each under 15 words
sentimentScore: integer between -100 and 100`,
        },
        {
          role: "user",
          content: `Search X and news for: "${question.slice(0, 200)}"`,
        },
      ],
      max_tokens: 400,
      temperature: 0.1,
    });

    const raw = response.choices?.[0]?.message?.content ?? "";

    // Multiple extraction strategies
    let parsed: any = null;

    // Strategy 1 — direct parse
    try { parsed = JSON.parse(raw.trim()); } catch {}

    // Strategy 2 — extract JSON object with regex
    if (!parsed) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {}
      }
    }

    // Strategy 3 — strip markdown fences
    if (!parsed) {
      const stripped = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      try { parsed = JSON.parse(stripped); } catch {}
    }

    if (!parsed) throw new Error(`Could not parse Grok response: ${raw.slice(0, 100)}`);

    // Validate and sanitize
    const result = {
      sentiment: ["bull", "bear", "neutral"].includes(parsed.sentiment)
        ? parsed.sentiment : "neutral",
      momentum: ["rising", "falling", "flat"].includes(parsed.momentum)
        ? parsed.momentum : "flat",
      topPosts: Array.isArray(parsed.topPosts)
        ? parsed.topPosts.slice(0, 3).map(String)
        : ["No recent posts found", "Monitoring X for updates", "Check back shortly"],
      newsHeadlines: Array.isArray(parsed.newsHeadlines)
        ? parsed.newsHeadlines.slice(0, 2).map(String)
        : ["No headlines found"],
      sentimentScore: typeof parsed.sentimentScore === "number"
        ? Math.max(-100, Math.min(100, Math.round(parsed.sentimentScore)))
        : 0,
      degraded: false,
      timestamp: Date.now(),
    };

    return NextResponse.json(result);

  } catch (err: any) {
    console.error("[Sentiment] Error:", err.message);
    return NextResponse.json({
      sentiment: "neutral",
      momentum: "flat",
      topPosts: [],
      newsHeadlines: [],
      sentimentScore: 0,
      degraded: true,
      error: err.message,
      timestamp: Date.now(),
    });
  }
}
