import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { market } = await request.json();

    if (!market || !market.question) {
      return NextResponse.json({ error: 'Market data with a question is required' }, { status: 400 });
    }

    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      console.warn('[Simulator] XAI_API_KEY env variable is missing. Running signals in simulator mode.');
      
      const yesPrice = market.yesPrice || 0.50;
      const volume = market.volume || 0;
      
      const sentiment = yesPrice >= 0.55 ? 'bull' : yesPrice <= 0.45 ? 'bear' : 'neutral';
      const momentum = volume > 5000000 ? 'trending' : volume > 100000 ? 'rising' : 'quiet';
      
      const keyPosts = [
        `[x_user_alpha] The momentum on "${market.question}" is picking up fast. Capital flows suggest YES is underpriced.`,
        `[x_user_beta] Looking at the resolution criteria, the risk profile is extremely skewed. Neutral stance is safer here.`
      ];
      
      const breakingNews = [
        `[Bloomberg] Prediction markets witness heavy trading volume for: ${market.question}`,
        `[Reuters] Live debate intensifies surrounding key catalysts of: ${market.question}`
      ];

      return NextResponse.json({
        sentiment,
        momentum,
        keyPosts,
        breakingNews,
        error: false,
        simulator: true
      });
    }

    // Call Grok 4.1 Fast via the xAI API (compatible with standard OpenAI chat payload)
    const url = 'https://api.x.ai/v1/chat/completions';

    const systemPrompt = `You are a real-time social sentiment scraping agent powered by Grok's deep X/Twitter and web integration. Your job is to search X (Twitter) and the web for recent discussions, reactions, breaking news, and social momentum regarding the given prediction market question.

Analyze current sentiment over the last 24-48 hours.
You MUST respond ONLY with a valid JSON object conforming to this schema (no markdown formatting, no code fences like \`\`\`, no conversational intro or outro text):
{
  "sentiment": "bull" | "bear" | "neutral",
  "momentum": "quiet" | "rising" | "trending",
  "keyPosts": ["<quoted post 1, max 30 words>", "<quoted post 2, max 30 words>"],
  "breakingNews": ["<breaking news headline 1>", "<breaking news headline 2>"]
}`;

    const userPrompt = `MARKET QUESTION TO SCRAPE:
- Question: "${market.question}"
- Category: "${market.category || 'General'}"
- Current Price: $${(market.yesPrice || 0.5).toFixed(2)}
- Description: "${market.description || 'N/A'}"

Run searches across X (Twitter) and the web to extract recent reactions, breaking news, sentiment, and trending posts. Return the JSON object.`;

    const body = {
      model: 'grok-4-1-fast',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools: [
        { type: 'live_search' }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    let resJson;
    if (!response.ok) {
      console.warn(`xAI API primary model grok-4-1-fast failed with status ${response.status}. Retrying with grok-2-latest...`);
      const fallbackBody = { ...body, model: 'grok-2-latest' };
      const fallbackResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(fallbackBody)
      });

      if (!fallbackResponse.ok) {
        const errText = await fallbackResponse.text();
        throw new Error(`xAI API primary and fallback models both failed. Primary status ${response.status}, Fallback status ${fallbackResponse.status}: ${errText}`);
      }
      resJson = await fallbackResponse.json();
    } else {
      resJson = await response.json();
    }

    const content = resJson.choices?.[0]?.message?.content || '';

    let parsedSignals;
    try {
      parsedSignals = parseCleanJson(content);
    } catch (e) {
      console.error('Failed to parse Grok JSON output directly, trying substr:', content);
      try {
        parsedSignals = parseCleanJson(content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1));
      } catch (nestedErr) {
        throw new Error('Grok output did not contain parseable JSON: ' + content);
      }
    }

    // Ensure format matches expectations
    return NextResponse.json({
      sentiment: parsedSignals.sentiment || 'neutral',
      momentum: parsedSignals.momentum || 'quiet',
      keyPosts: Array.isArray(parsedSignals.keyPosts) ? parsedSignals.keyPosts : [],
      breakingNews: Array.isArray(parsedSignals.breakingNews) ? parsedSignals.breakingNews : [],
      error: false
    });

  } catch (err: any) {
    console.error('Error in /api/signals route:', err);
    // If xAI API errors, return standard fallback JSON as requested by spec
    return NextResponse.json({
      sentiment: 'neutral',
      momentum: 'quiet',
      keyPosts: [],
      breakingNews: [],
      error: true,
      errorMessage: err.message || 'Scraping failed'
    });
  }
}

function parseCleanJson(text: string) {
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(json)?\n/, '');
    cleanText = cleanText.replace(/\n```$/, '');
    cleanText = cleanText.trim();
  }
  return JSON.parse(cleanText);
}
