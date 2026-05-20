import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const { market, analysis, history, message } = await request.json();

    if (!market || !message) {
      return NextResponse.json({ error: 'Market data and message are required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.warn('[Simulator] ANTHROPIC_API_KEY env variable is missing. Running chat in simulator mode.');
      
      const userMessageLower = message.toLowerCase();
      let response = '';

      const currentYesOdds = market.yesPrice || 0.50;
      const verdict = analysis?.verdict || 'SKIP';
      const confidence = analysis?.confidence ? Math.round(analysis.confidence * 100) : 50;
      const volume = market.volume || 0;

      if (userMessageLower.includes('bear') || userMessageLower.includes('risk') || userMessageLower.includes('uncertain')) {
        response = `Analyzing the bear case and tail risks for "${market.question}": The current YES price is $${currentYesOdds.toFixed(2)} (${Math.round(currentYesOdds * 100)}% odds). The primary risk catalyst is the high level of uncertainty around regulatory milestones or sudden external macro shifts. Additionally, ${volume > 1000000 ? `with a substantial $${volume.toLocaleString()} in trading volume,` : ''} any surprise insider development could trigger an aggressive order book flush, reversing the current sentiment instantly. We strongly advise monitoring these tail-risks closely.`;
      } else if (userMessageLower.includes('bull') || userMessageLower.includes('upside') || userMessageLower.includes('edge')) {
        response = `Reviewing the upside case and calculated edge for "${market.question}": Our analysis points to a projected confidence of ${confidence}% against the market odds of ${Math.round(currentYesOdds * 100)}%. If these odds hold, the implied edge is ${Math.round((confidence/100 - currentYesOdds)*100)}% percentage points. The bullish momentum is supported by active X (Twitter) sentiment indicators and growing liquidity depth. This structural imbalance offers a favorable entry point if resolution factors continue to align.`;
      } else if (userMessageLower.includes('why') || userMessageLower.includes('verdict') || userMessageLower.includes('opinion')) {
        response = `Our active verdict is set to ${verdict} with a confidence level of ${confidence}%. This choice is mathematically grounded by comparing the true resolution probability against the current Polymarket pricing of $${currentYesOdds.toFixed(2)}. Since the calculated edge of ${Math.round((confidence/100 - currentYesOdds)*100)}% is ${verdict === 'SKIP' ? 'too narrow (within 5%) to justify risk exposure,' : `substantial, the ${verdict} position presents high mathematical advantage.`} Furthermore, news streams and social signal scrapers lean ${currentYesOdds >= 0.55 ? 'strongly supportive' : currentYesOdds <= 0.45 ? 'highly critical' : 'neutral'} on this specific question.`;
      } else {
        response = `Polydict Trading Desk here. Regarding "${market.question}": The contract currently trades at $${currentYesOdds.toFixed(2)} with a total volume of $${volume.toLocaleString()}. Our simulated model evaluates true resolution probability at ${confidence}%, leading to a ${verdict} verdict (implied edge: ${Math.round((confidence/100 - currentYesOdds)*100)}pp). X sentiment streams indicate rising momentum and active discussions. What specific detail—such as the risk factors, macro catalysts, or order book liquidity—would you like to dissect further?`;
      }

      return NextResponse.json({ response });
    }

    // Correctly extract pre-fetched Grok sentiment signals from the analysis object
    const signals = analysis?.grokSignals;

    // Run a live web search for the user's chat query to get real-time context
    const { searchWeb } = await import('../../../utils/search');
    const searchResults = await searchWeb(message);
    const searchContext = searchResults
      .map((r, idx) => `[Search Result ${idx + 1}] Title: "${r.title}"\nSnippet: "${r.snippet}"\nURL: ${r.url}`)
      .join('\n\n');

    const anthropic = new Anthropic({ apiKey });

    // Format chat history for Claude messages
    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    }));

    const systemPrompt = `You are a sharp prediction market analyst for Polymarket. You are in a chat terminal discussing this specific market:
Question: "${market.question}"
Verdict: ${analysis?.verdict || 'SKIP'}
Confidence: ${analysis?.confidence ? Math.round(analysis.confidence * 100) : 50}%
Current Odds: ${Math.round(market.yesPrice * 100)}%

You have access to the pre-fetched Grok sentiment signals for this market:
${signals ? JSON.stringify(signals, null, 2) : 'No X sentiment pre-fetched.'}

Answer the user's questions clearly, analytically, and concisely. Use the live web search results provided in their message to give highly accurate, real-time responses.

CRITICAL RULES:
- Keep your response strictly under 120 words.
- Maintain a sharp, trading-desk terminal persona.
- Provide plain text replies (use simple paragraphs, no markdown headings, keep lists short if any).`;

    const userPrompt = `LIVE WEB SEARCH FOR USER'S QUERY:
${searchContext || 'No recent web search results found for this query.'}

USER'S MESSAGE:
${message}`;

    const messages = [
      ...formattedHistory,
      { role: 'user' as const, content: userPrompt }
    ];

    let response;
    try {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 250,
        system: systemPrompt,
        messages: messages,
        temperature: 0.7,
      });
    } catch (err: any) {
      console.warn('Anthropic API failed with model claude-sonnet-4-6, retrying with claude-3-5-sonnet-latest. Error:', err.message);
      response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 250,
        system: systemPrompt,
        messages: messages,
        temperature: 0.7,
      });
    }

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ response: reply.trim() });

  } catch (err: any) {
    console.error('Error in /api/chat route:', err);
    return NextResponse.json({ error: err.message || 'Chat failed' }, { status: 500 });
  }
}
