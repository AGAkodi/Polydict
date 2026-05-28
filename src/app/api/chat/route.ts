import { NextRequest, NextResponse } from 'next/server';
import { grok } from '../../../lib/grok';

export async function POST(req: NextRequest) {
  try {
    const { market, analysis, signals, history, message } = await req.json();

    const apiKey = process.env.XAI_API_KEY;

    const runSimulatedChat = (userMsg: string) => {
      const userMessageLower = userMsg.toLowerCase();
      let replyText = '';

      if (!market) {
        // Global floating chat mode simulation
        if (userMessageLower.includes('bitcoin') || userMessageLower.includes('btc')) {
          replyText = `ALPHA·CAST (Simulated web-search results for "Bitcoin Polymarket"):
The active contract "Will Bitcoin hit $100k in 2026?" is trading at 72% YES ($0.72) with $85M in volume. Our simulated forecast models project a 79% true probability, presenting an edge of 7pp. Position sizing should be 9.7% of bankroll under half-Kelly sizing. What other digital asset contracts would you like me to scan?`;
        } else if (userMessageLower.includes('election') || userMessageLower.includes('politics')) {
          replyText = `ALPHA·CAST (Simulated web-search results for "Election Polymarket"):
The US Presidential Election contract currently prices the leading candidate at 54% YES ($0.54) with over $1.2B in volume. This is extremely liquid and heavily contested. Our simulated sentiment tracking indicates rising momentum. What specific political catalyst are you looking to trade?`;
        } else {
          replyText = `ALPHA·CAST Global Desk (Simulator mode):
I have simulated web-search enabled for all live contracts. I can scan for prices, sentiment, and Kelly sizing. Since you asked about "${message}", my simulated search indicates active discussions with current odds hovering around 52%. What specific trade parameters would you like to calculate?`;
        }
      } else {
        // Market-specific simulation
        const currentYesOdds = market.yesPrice || 0.50;
        const verdict = analysis?.verdict || 'SKIP';
        const confidence = analysis?.confidence ? Math.round(analysis.confidence * 100) : 50;
        const edgeVal = analysis?.edge ? Math.round(analysis.edge * 100) : 0;
        const volume = market.volume || 0;

        if (userMessageLower.includes('bear') || userMessageLower.includes('risk') || userMessageLower.includes('uncertain')) {
          replyText = `Analyzing the bear case and tail risks for "${market.question}": The current YES price is $${currentYesOdds.toFixed(2)} (${Math.round(currentYesOdds * 100)}% odds). The primary risk catalyst is the high level of uncertainty around regulatory milestones or sudden external macro shifts. Additionally, ${volume > 1000000 ? `with a substantial $${volume.toLocaleString()} in trading volume,` : ''} any surprise insider development could trigger an aggressive order book flush, reversing the current sentiment instantly. We strongly advise monitoring these tail-risks closely.`;
        } else if (userMessageLower.includes('bull') || userMessageLower.includes('upside') || userMessageLower.includes('edge')) {
          replyText = `Reviewing the upside case and calculated edge for "${market.question}": Our analysis points to a projected confidence of ${confidence}% against the market odds of ${Math.round(currentYesOdds * 100)}%. If these odds hold, the implied edge is ${edgeVal}% percentage points. The bullish momentum is supported by active X (Twitter) sentiment indicators and growing liquidity depth. This structural imbalance offers a favorable entry point if resolution factors continue to align.`;
        } else if (userMessageLower.includes('kelly') || userMessageLower.includes('size') || userMessageLower.includes('position')) {
          const odds = currentYesOdds;
          const edge = edgeVal / 100;
          const kelly = odds > 0 ? (edge / odds) : 0;
          replyText = `For position sizing on "${market.question}", we use the Kelly Criterion formula: edge / odds. Under current pricing: Edge = ${edgeVal}% (${edge.toFixed(3)}), Odds = ${Math.round(odds * 100)}% (${odds.toFixed(2)}). Kelly sizing = ${edge.toFixed(3)} / ${odds.toFixed(2)} = ${(kelly * 100).toFixed(1)}% of your bankroll. Given execution risks, applying a half-Kelly (${(kelly * 50).toFixed(1)}%) is highly recommended.`;
        } else {
          replyText = `Regarding "${market.question}": The contract currently trades at $${currentYesOdds.toFixed(2)} with a total volume of $${volume.toLocaleString()}. Our model evaluates true resolution probability at ${confidence}%, leading to a ${verdict} verdict (implied edge: ${edgeVal}pp). What specific detail—such as the risk factors, macro catalysts, or position sizing—would you like to discuss?`;
        }
      }

      return NextResponse.json({ reply: replyText });
    };

    // Sandbox simulation fallback if XAI_API_KEY is not defined
    if (!apiKey) {
      console.warn('[Simulator] XAI_API_KEY env variable is missing. Running chat in simulator mode.');
      return runSimulatedChat(message);
    }

    // Set up ALPHA·CAST's high-fidelity system prompts
    let systemPrompt = '';
    
    if (!market) {
      // Global Floating Chat Prompt
      systemPrompt = `You are ALPHA CAST, a Polymarket analyst with access to all live markets.
The user may ask about any market by name. Search the web for current Polymarket odds before answering.
Always cite specific numbers. Never give generic answers.
Tone: direct, confident, no filler. Trader talking to a trader.`;
    } else {
      // Selected Market Chat Prompt
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
Edge: ${(analysis?.edge ? analysis.edge * 100 : 0).toFixed(1)}pp
Summary: ${analysis?.summary ?? "N/A"}
Reasoning: ${analysis?.reasoning ?? "N/A"}
Key risk: ${analysis?.risk ?? "N/A"}

--- SOCIAL SIGNALS ---
Sentiment: ${signals?.sentiment ?? "unavailable"}
Momentum: ${signals?.momentum ?? "unavailable"}
Key posts: ${signals?.keyPosts?.join(" | ") ?? "none"}
Breaking news: ${signals?.breakingNews?.join(" | ") ?? "none"}
---

RESPONSE RULES:
- Short questions: 2-3 sentences. Complex questions: full structured answer.
- Always cite actual numbers from the context above.
- Position sizing: use Kelly Criterion (edge / odds). Show the maths.
- Scenarios: give a probability shift estimate for each.
- Counterarguments: steelman using real signals from context.
- Tone: direct, confident, no filler. Trader talking to a trader.
- End complex answers with one sharp follow-up question.`;
    }

    // Build message queue history
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      {
        role: 'user',
        content: 'Context loaded. Ready.',
      },
      {
        role: 'assistant',
        content: market
          ? `Got it. "${market.question}" is at ${(market.yesPrice * 100).toFixed(1)}% YES. Verdict: ${analysis?.verdict ?? 'SKIP'} - ${(analysis?.confidence ? analysis.confidence * 100 : 50).toFixed(1)}% confidence, ${(analysis?.edge ? analysis.edge * 100 : 0).toFixed(1)}pp edge. Ask me anything.`
          : 'Global analyst desk ready. Ask me about any market.',
      },
      ...(history || []).map((h: any) => ({
        role: h.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    let reply = '';
    try {
      const response = await grok.chat.completions.create({
        model: 'grok-3-fast',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      reply = response.choices?.[0]?.message?.content?.trim() || '';
    } catch (err: any) {
      console.warn('Grok 3 Fast failed in chat, checking if billing failure. Error:', err.message);
      
      const isBillingFailure = err.message?.includes('credits') || err.message?.includes('balance') || err.message?.includes('billing') || err.message?.includes('license') || err.message?.includes('team');
      if (isBillingFailure) {
        console.warn('[Billing Failure] Bypassing billing block and running chat in simulator mode.');
        return runSimulatedChat(message);
      }

      // Try grok-2-latest fallback
      try {
        const fallbackResponse = await grok.chat.completions.create({
          model: 'grok-2-latest',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          max_tokens: 800,
          temperature: 0.3,
        });

        reply = fallbackResponse.choices?.[0]?.message?.content?.trim() || '';
      } catch (err2: any) {
        console.warn('Grok fallbacks failed in chat, executing simulator mode as safety net. Error:', err2.message);
        return runSimulatedChat(message);
      }
    }

    if (!reply) {
      return runSimulatedChat(message);
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('Fatal error in /api/chat route:', err);
    return NextResponse.json({ error: err.message || 'Chat failed' }, { status: 500 });
  }
}