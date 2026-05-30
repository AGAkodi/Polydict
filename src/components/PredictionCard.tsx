import React, { useState, useEffect } from 'react';
import { MergedMarket } from '../utils/polymarket';
import { formatVolume, getCountdown } from '../utils/helpers';

interface Signal {
  direction: 'bull' | 'bear' | 'neutral';
  source?: 'news' | 'social' | 'market';
  text: string;
}

interface AnalysisResult {
  verdict: 'YES' | 'NO' | 'SKIP';
  confidence: number;
  edge: number;
  summary: string;
  signals: Signal[];
  reasoning: string;
  risk: string;
  suggestedQuestions: string[];
  grokSignals?: {
    sentiment: 'bull' | 'bear' | 'neutral';
    momentum: 'quiet' | 'rising' | 'trending';
    keyPosts: string[];
    breakingNews: string[];
    error: boolean;
  };
}

interface PredictionCardProps {
  market: MergedMarket | null;
  livePrices?: Record<string, { yes: number; no: number; vol: number }> | null;
  pricesError?: boolean;
  onAnalysisLoaded: (analysis: AnalysisResult) => void;
  triggerReanalyzeCount: number;
  onAskAI?: () => void;
}

const STORAGE_KEY_PREFIX = 'analysis_';
const CACHE_TTL = 86400000; // 24 hours in ms

const getConciseReasoning = (text: string) => {
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  return sentences.slice(0, 3).join("").trim();
};

export default function PredictionCard({ 
  market, 
  livePrices, 
  pricesError, 
  onAnalysisLoaded, 
  triggerReanalyzeCount,
  onAskAI
}: PredictionCardProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzedAtPrice, setAnalyzedAtPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'grok' | 'claude' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Kelly Bet Calculator Input State
  const [sizerBet, setSizerBet] = useState<string>("1000");

  // Heatmap tracking states
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [lastVolume, setLastVolume] = useState<number | null>(null);
  const [pulseArrow, setPulseArrow] = useState<'↑' | '↓' | '→'>('→');
  const [pulseArrowClass, setPulseArrowClass] = useState<string>('text-slate-400');
  const [volDriftClass, setVolDriftClass] = useState<string>('border-[#1e2a38]/80 text-slate-500');
  // Change 4: Sentiment Feed state variables
  const [sentimentData, setSentimentData] = useState<{
    sentiment: 'bull' | 'bear' | 'neutral';
    momentum: 'rising' | 'falling' | 'flat';
    topPosts: string[];
    newsHeadlines: string[];
    sentimentScore: number;
    degraded?: boolean;
  } | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState(false);
  const [lastUpdatedSeconds, setLastUpdatedSeconds] = useState(0);

  const currentPrice = market ? (livePrices?.[market.conditionId]?.yes ?? market.yesPrice) : null;
  const livePriceData = market ? livePrices?.[market.conditionId] : null;
  const currentVol = market ? (livePriceData?.vol ?? market.volume) : null;

  useEffect(() => {
    if (currentPrice !== null && currentPrice !== undefined) {
      if (lastPrice !== null) {
        if (currentPrice > lastPrice) {
          setPulseArrow('↑');
          setPulseArrowClass('text-[#00e676]');
        } else if (currentPrice < lastPrice) {
          setPulseArrow('↓');
          setPulseArrowClass('text-[#ff5252]');
        } else {
          setPulseArrow('→');
          setPulseArrowClass('text-slate-400');
        }
      }
      setLastPrice(currentPrice);
    }
  }, [currentPrice]);

  useEffect(() => {
    if (currentVol !== null && currentVol !== undefined) {
      if (lastVolume !== null) {
        const diff = currentVol - lastVolume;
        if (diff > 5000) {
          setVolDriftClass('border-[#00e676]/40 bg-[#00e676]/5 text-[#00e676] shadow-[0_0_10px_rgba(0,230,118,0.15)]');
        } else if (diff > 0) {
          setVolDriftClass('border-[#00d4ff]/30 bg-[#00d4ff]/5 text-[#00d4ff]');
        } else {
          setVolDriftClass('border-[#1e2a38]/80 text-slate-500');
        }
      }
      setLastVolume(currentVol);
    }
  }, [currentVol]);

  // Core market analysis fetch & cache logic
  useEffect(() => {
    if (!market) {
      setAnalysis(null);
      setAnalyzedAtPrice(null);
      return;
    }

    const cached = localStorage.getItem(`${STORAGE_KEY_PREFIX}${market.id}`);
    if (cached) {
      try {
        const { timestamp, analyzedAtPrice: cachedPrice, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setAnalysis(data);
          setAnalyzedAtPrice(cachedPrice !== undefined ? cachedPrice : market.yesPrice);
          onAnalysisLoaded(data);
          setError(null);
          return;
        }
      } catch (e) {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${market.id}`);
      }
    }

    runAnalysis(market);
  }, [market]);

  // Run fresh analysis when manual re-analyze triggers
  useEffect(() => {
    if (market && triggerReanalyzeCount > 0) {
      runAnalysis(market, true);
    }
  }, [triggerReanalyzeCount]);

  // Polling Pipeline for Live X Sentiment
  useEffect(() => {
    if (!market) {
      setSentimentData(null);
      setSentimentError(false);
      return;
    }

    const fetchSentiment = async () => {
      setSentimentLoading(true);
      try {
        const res = await fetch('/api/sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: market.question }),
        });
        if (!res.ok) throw new Error('Sentiment feed offline');
        const data = await res.json();
        console.log("[Sentiment]", data);
        setSentimentData(data);
        setSentimentError(false);
        setLastUpdatedSeconds(0); // Reset count on successful poll
      } catch (err) {
        console.error('Sentiment fetch error:', err);
        setSentimentError(true);
      } finally {
        setSentimentLoading(false);
      }
    };

    // Run immediately on selection
    fetchSentiment();

    // Poll every 30 seconds
    const pollInterval = setInterval(() => {
      fetchSentiment();
    }, 30000);

    // Update timer every second
    const timerInterval = setInterval(() => {
      setLastUpdatedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [market]);

  const runAnalysis = async (targetMarket: MergedMarket, forceRefetch = false) => {
    setLoading(true);
    setLoadingPhase('grok');
    setError(null);
    try {
      const signalsRes = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: targetMarket }),
      });

      if (!signalsRes.ok) {
        throw new Error('Grok signal scraper endpoint failed');
      }

      const signalsData = await signalsRes.json();

      setLoadingPhase('claude');
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: targetMarket, signals: signalsData }),
      });

      if (!analyzeRes.ok) {
        throw new Error('Claude analysis core failed');
      }

      const analyzeData = (await analyzeRes.json()) as AnalysisResult;

      const finalResult: AnalysisResult = {
        ...analyzeData,
        grokSignals: signalsData,
      };

      setAnalysis(finalResult);
      setAnalyzedAtPrice(targetMarket.yesPrice);
      onAnalysisLoaded(finalResult);

      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${targetMarket.id}`,
        JSON.stringify({
          timestamp: Date.now(),
          analyzedAtPrice: targetMarket.yesPrice,
          data: finalResult,
        })
      );
    } catch (err: any) {
      console.error('Error analyzing market:', err);
      setError(err.message || 'Failed to complete pipeline analysis');
    } finally {
      setLoading(false);
      setLoadingPhase(null);
    }
  };

  if (pricesError) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#080c10] border-r border-[#1e2a38] text-center select-none animate-fade-in font-mono">
        <div className="max-w-md space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#ff5252]/5 border border-[#ff5252]/15 flex items-center justify-center text-[#ff5252] text-2xl font-bold animate-pulse">
            ERR
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#ff5252]">Polymarket CLOB API Offline</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Live price feeds could not be retrieved from the Polymarket CLOB order book. Telemetry operations are paused to prevent stale or simulated data usage.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="h-full flex flex-col bg-[#080c10] border-r border-[#1e2a38] relative select-text">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none animate-fade-in font-mono">
          <div className="max-w-md space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#00d4ff]/5 border border-[#00d4ff]/15 flex items-center justify-center text-[#00d4ff] text-2xl font-bold animate-pulse">
              PD
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-200">PolyDict Intelligence Standby</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Select any active Polymarket prediction contract from the left sidebar to initialize real-time AI analyst resolution.
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-[#1e2a38] bg-[#0d1219]/60 shrink-0 text-slate-500 text-[10px] leading-relaxed font-sans text-center select-none">
          NFA — This is not financial advice. Prediction markets carry significant risk. <br />
          Always do your own research. DYOR as always.
        </div>
      </div>
    );
  }

  const currentPriceNum = currentPrice!;
  const priceDrift = analyzedAtPrice != null && currentPriceNum != null
    ? Math.abs(currentPriceNum - analyzedAtPrice)
    : 0;

  const reAnalyze = () => {
    runAnalysis(market, true);
  };

  const yesOdds = Math.round(currentPriceNum * 100);
  const countdown = getCountdown(market.endDateIso || market.endDate);

  const getCountdownStyles = (severity: string) => {
    switch (severity) {
      case 'red':
        return 'border-[#ff5252]/30 bg-[#ff5252]/5 text-[#ff5252]';
      case 'amber':
        return 'border-[#ffab40]/30 bg-[#ffab40]/5 text-[#ffab40]';
      case 'closed':
        return 'border-[#1e2a38] bg-[#0d1219] text-slate-600';
      case 'gray':
      default:
        return 'border-[#1e2a38] bg-[#0d1219] text-slate-400';
    }
  };

  // Section 6 Kelly math calculations
  const edgeVal = analysis?.edge || 0;
  const oddsVal = currentPriceNum || 0.50;
  const edgePct = Math.round(edgeVal * 100);
  const betAmount = parseFloat(sizerBet) || 0;

  const isEdgePositive = edgeVal > 0;
  const fullKellyBet = isEdgePositive ? (edgeVal / oddsVal) * betAmount : 0;
  const halfKellyBet = isEdgePositive ? 0.5 * (edgeVal / oddsVal) * betAmount : 0;

  // Visual comparison bar settings (Section 1)
  const confidencePct = analysis ? Math.round(analysis.confidence * 100) : 50;
  let barColorClass = '';
  if (analysis) {
    if (Math.abs(analysis.confidence - currentPriceNum) <= 0.03) {
      barColorClass = 'bg-[#ffab40]';
    } else if (analysis.confidence > currentPriceNum) {
      barColorClass = 'bg-[#00e676]';
    } else {
      barColorClass = 'bg-[#ff5252]';
    }
  }

  // English verdict generator (Section 2)
  const getVerdictSentenceText = () => {
    if (!analysis) return '';
    const absEdge = Math.abs(edgePct);
    if (analysis.verdict === 'YES') {
      return `PolyDict rates this ${absEdge}pp higher than the market — lean YES.`;
    } else if (analysis.verdict === 'NO') {
      return `Market is overpricing this — PolyDict says NO at ${confidencePct}% confidence.`;
    } else {
      return `Edge is too thin to call — PolyDict says hold off.`;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#080c10] border-r border-[#1e2a38] relative select-text">
      {/* Scanning loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#080c10]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 space-y-6 select-none font-mono">
          <div className="relative flex items-center justify-center">
            <div className={`w-16 h-16 border-2 rounded-full animate-spin ${
              loadingPhase === 'grok' 
                ? 'border-t-[#ffab40] border-r-transparent border-b-transparent border-l-transparent shadow-[0_0_15px_rgba(255,171,64,0.3)]' 
                : 'border-t-[#00d4ff] border-r-transparent border-b-transparent border-l-transparent shadow-[0_0_15px_rgba(0,212,255,0.3)]'
            }`} />
            <div className="absolute text-[10px] font-bold text-slate-400">
              {loadingPhase === 'grok' ? 'X-AI' : 'CLAUDE'}
            </div>
          </div>
          <div className="text-xs text-slate-300 font-medium tracking-wide space-y-3 text-center max-w-xs">
            <div className={`font-bold animate-pulse text-sm ${
              loadingPhase === 'grok' ? 'text-[#ffab40]' : 'text-[#00d4ff]'
            }`}>
              {loadingPhase === 'grok' ? 'PHASE 1: SOCIAL SIGNAL SCRAPE' : 'PHASE 2: DEEP FORECAST ANALYSIS'}
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed border border-[#1e2a38] bg-[#0d1219] p-3 rounded-lg">
              {loadingPhase === 'grok' 
                ? 'Fetching X/Twitter sentiment signals via Grok 4.1 Fast with live web & social scraping enabled...'
                : 'Scraped signals injected. Executing Claude 3.5 Sonnet reasoning core with mathematical validation constraints...'
              }
            </p>
          </div>
        </div>
      )}

      {/* Main card viewport - scrollable */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
        {/* Header Metadata */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded border border-[#00d4ff]/20 bg-[#00d4ff]/5 text-[10px] font-bold text-[#00d4ff] uppercase tracking-wider font-mono">
              {market.category}
            </span>
            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider font-mono ${getCountdownStyles(countdown.severity)}`}>
              {countdown.label}
            </span>
          </div>

          <h2 className="text-lg font-bold text-white leading-relaxed select-text font-sans">
            {market.question}
          </h2>

          <div className="flex justify-between items-center text-xs font-semibold text-slate-500 border-b border-[#1e2a38] pb-3 font-mono">
            <span>VOLUME: <strong className="text-slate-300">${market.volume.toLocaleString()}</strong></span>
            <span>LIQUIDITY: <strong className="text-slate-300">${market.liquidity.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Prediction Results block */}
        {error ? (
          error.includes('API_KEY') || error.includes('credentials') || error.includes('API key') ? (
            <div className="p-5 rounded-xl border border-[#ff5252]/30 bg-[#ff5252]/[0.02] space-y-4 font-mono select-text animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ff5252] tracking-wider uppercase border-b border-[#ff5252]/20 pb-2">
                <span className="animate-pulse">⚠</span>
                <span>API Configuration Required</span>
              </div>
              
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                PolyDict runs in a strict <strong className="text-[#00d4ff]">live-only telemetry mode</strong>. To execute real-time social sentiment scraping via Grok and dual-model analyst reasoning via Claude, you must define your API keys in your local environment.
              </p>

              <div className="space-y-3 text-[11px] bg-[#0d1219] p-3.5 rounded border border-[#1e2a38] text-slate-300">
                <div className="font-bold text-[#00d4ff] uppercase border-b border-[#1e2a38]/40 pb-1.5 mb-2 flex justify-between items-center">
                  <span>Workspace Setup Steps</span>
                  <span className="text-[9px] bg-[#00d4ff]/10 text-[#00d4ff] px-1.5 py-0.5 rounded">.env.local</span>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="text-[#00d4ff] font-bold">1.</span>
                    <p className="font-sans">
                      Open <strong className="text-slate-100 font-mono text-[10px] bg-[#080c10] px-1 py-0.5 border border-[#1e2a38] rounded">.env.local</strong> in your project root folder.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#00d4ff] font-bold">2.</span>
                    <p className="font-sans">
                      Define the following variables with your credentials (no quotes or spaces):
                    </p>
                  </div>
                  <pre className="text-[10px] bg-[#080c10] p-2 rounded border border-[#1e2a38]/60 text-[#00e676] overflow-x-auto select-all leading-normal font-bold">
{`ANTHROPIC_API_KEY=your-anthropic-key-here
GROQ_API_KEY=your-groq-key-here
XAI_API_KEY=your-xai-key-here`}
                  </pre>
                  <div className="flex gap-2">
                    <span className="text-[#00d4ff] font-bold">3.</span>
                    <p className="font-sans">
                      Save the file and click the retry button below to re-initiate telemetry.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => runAnalysis(market, true)}
                  className="px-4 py-2.5 bg-[#ff5252]/10 border border-[#ff5252] hover:bg-[#ff5252]/20 hover:border-[#ff5252] text-[#ff5252] font-bold text-xs rounded transition-all cursor-pointer font-mono shadow-[0_0_10px_rgba(255,82,82,0.1)] active:scale-[0.98]"
                >
                  RETRY Live Resolution
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded border border-[#ff5252]/30 bg-[#ff5252]/5 text-xs text-[#ff5252] space-y-2 font-mono">
              <div className="font-bold">SYSTEM ERROR: PIPELINE DEPLOYMENT FAILURE</div>
              <div className="text-[11px] leading-relaxed font-sans">{error}</div>
              <button
                onClick={() => runAnalysis(market, true)}
                className="mt-1 px-3 py-1 bg-[#ff5252]/10 border border-[#ff5252]/30 rounded text-[#ff5252] font-bold hover:bg-[#ff5252]/20 cursor-pointer transition-all"
              >
                RETRY RESOLUTION
              </button>
            </div>
          )
        ) : analysis ? (
          <div className="space-y-6 animate-fade-in">
            {/* Price Drift Warning Banner */}
            {priceDrift > 0.03 && (
              <div className="p-3.5 rounded border border-l-4 border-[#ffab40]/40 border-l-[#ffab40] bg-[#ffab40]/[0.03] text-xs font-mono text-[#ffab40] flex items-center justify-between gap-3 animate-fade-in shrink-0">
                <div className="flex items-center gap-2">
                  <span>⚠</span>
                  <span className="font-semibold text-slate-200">
                    Odds moved {(priceDrift * 100).toFixed(1)} percentage point since scan
                  </span>
                </div>
                <button 
                  onClick={reAnalyze}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-[#ffab40]/40 bg-[#ffab40]/10 rounded hover:bg-[#ffab40]/20 text-[#ffab40] cursor-pointer transition-all active:scale-[0.97] shrink-0"
                >
                  Re-analyze
                </button>
              </div>
            )}

            {/* STUNNING PROMINENT VERDICT BANNER */}
            <div className={`p-5 rounded-xl border font-mono transition-all duration-300 ${
              analysis.verdict === 'YES' ? 'bg-[#00e676]/10 animate-pulse-yes' :
              analysis.verdict === 'NO' ? 'bg-[#ff5252]/10 animate-pulse-no' :
              'bg-[#ffab40]/10 animate-pulse-skip'
            }`}>
              {/* Verdict Label */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-3 w-3 rounded-full animate-ping ${
                  analysis.verdict === 'YES' ? 'bg-[#00e676]' :
                  analysis.verdict === 'NO' ? 'bg-[#ff5252]' : 'bg-[#ffab40]'
                }`} />
                <h3 className={`text-3xl font-black font-mono tracking-wider ${
                  analysis.verdict === 'YES' ? 'text-[#00e676]' :
                  analysis.verdict === 'NO' ? 'text-[#ff5252]' : 'text-[#ffab40]'
                }`}>
                  {analysis.verdict}
                </h3>
              </div>

              {/* Dynamic Explanation Sentence */}
              <p className="text-sm text-slate-300 font-sans leading-relaxed mb-4">
                "{
                  analysis.verdict === 'YES'
                    ? `The market prices this at ${yesOdds}%. PolyDict estimates ${confidencePct}% probability — a ${Math.abs(edgePct)} percentage point edge worth taking.`
                    : analysis.verdict === 'NO'
                    ? `The market is overpricing this at ${yesOdds}%. PolyDict puts true odds at ${confidencePct}% — lean NO.`
                    : `Edge is only ${Math.abs(edgePct)} percentage point — too thin to act on. Monitor and revisit.`
                }"
              </p>

              {/* WHY Label and Summary */}
              <div className="space-y-1 mb-4 pt-3 border-t border-[#1e2a38]/30">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  WHY {analysis.verdict}
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  {analysis.summary}
                </p>
              </div>

              {/* Side-by-side Progress Bars */}
              <div className="flex gap-4 items-center pt-3 border-t border-[#1e2a38]/30 text-xs font-mono">
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-slate-400 text-[10px] font-bold">
                    <span>CONFIDENCE</span>
                    <span className="text-white">{confidencePct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#1e2a38]/50 rounded-full overflow-hidden">
                    <div className={`h-full ${
                      analysis.verdict === 'YES' ? 'bg-[#00e676]' :
                      analysis.verdict === 'NO' ? 'bg-[#ff5252]' : 'bg-[#ffab40]'
                    }`} style={{ width: `${confidencePct}%` }} />
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-slate-400 text-[10px] font-bold">
                    <span>MARKET ODDS</span>
                    <span className="text-white">{yesOdds}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#1e2a38]/50 rounded-full overflow-hidden">
                    <div className="h-full bg-[#00d4ff]" style={{ width: `${yesOdds}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Why (reasoning condensed) */}
            <div className="space-y-1.5 font-mono">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">[Analyst Reasoning]</div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans bg-[#0d1219] p-4 rounded border border-[#1e2a38] font-sans">
                {getConciseReasoning(analysis.reasoning)}
              </p>
            </div>

            {/* SECTION 4: Want to know more? Chat link prompt */}
            {onAskAI && (
              <div className="py-0.5 font-mono select-none">
                <button
                  type="button"
                  onClick={onAskAI}
                  className="w-full text-left text-xs font-bold text-[#00d4ff] hover:text-[#00e676] bg-transparent border-none cursor-pointer transition-all flex items-center gap-1 font-mono hover:underline"
                >
                  &gt; Ask the AI analyst for scenarios, position sizing, or deeper signals →
                </button>
              </div>
            )}

            {/* SECTION 5: Live Market Pulse Heatmap */}
            <div className="p-4 rounded-xl bg-[#0d1219]/90 border border-[#1e2a38] backdrop-blur-md space-y-4 font-mono shadow-[0_0_15px_rgba(0,212,255,0.03)] animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1e2a38] pb-2">
                <span className="text-xs font-bold text-[#00d4ff] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-ping" />
                  Live Market Pulse
                </span>
                <span className="text-[9px] text-slate-500 font-semibold uppercase">TELEMETRY</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Momentum Dial */}
                <div className="p-3 rounded-lg bg-[#080c10] border border-[#1e2a38]/80 flex flex-col justify-between space-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Price Momentum</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${pulseArrowClass}`}>{pulseArrow}</span>
                    <span className={`text-xs font-bold ${pulseArrowClass}`}>
                      {pulseArrow === '↑' ? 'RISING DRIFT' : pulseArrow === '↓' ? 'DOWNWARD DRIFT' : 'STABLE'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-sans">
                    Drift: {(priceDrift * 100).toFixed(1)} percentage point from initial scan
                  </span>
                </div>

                {/* Volume Change Dial */}
                <div className={`p-3 rounded-lg bg-[#080c10] border flex flex-col justify-between space-y-2 transition-all duration-300 ${volDriftClass}`}>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Volume Pulse</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200">
                      ${(currentVol || 0).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[9px] font-sans">
                    Active contract flow telemetry
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 6: Interactive Kelly Bet Sizer */}
            <div className="p-4 rounded-xl bg-[#0d1219]/90 border border-[#1e2a38] backdrop-blur-md space-y-4 font-mono shadow-[0_0_15px_rgba(0,212,255,0.03)]">
              <div className="flex items-center justify-between border-b border-[#1e2a38] pb-2">
                <span className="text-xs font-bold text-[#00d4ff] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
                  Kelly Sizer
                </span>
                <span className="text-[9px] text-[#00d4ff] font-bold border border-[#00d4ff]/20 bg-[#00d4ff]/5 px-1.5 py-0.5 rounded">
                  Bet Calculator
                </span>
              </div>

              {/* Bankroll Betting field input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                  <span>I WANT TO BET $</span>
                  <span className="text-slate-500">USD</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                  <input 
                    type="number"
                    value={sizerBet}
                    onChange={(e) => setSizerBet(e.target.value)}
                    placeholder="Enter bet size..."
                    className="w-full bg-[#080c10] border border-[#1e2a38] rounded p-2 pl-7 text-xs font-bold text-slate-200 focus:outline-none focus:border-[#00d4ff] transition-all"
                  />
                </div>
              </div>

              {/* Kelly Betting outputs */}
              <div className="p-3 rounded-lg bg-[#080c10] border border-[#1e2a38] space-y-2.5 font-mono">
                {!isEdgePositive ? (
                  <div className="text-[11px] font-bold text-[#ffab40] text-center py-2 animate-pulse">
                    No edge detected — Kelly recommends $0
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs border-b border-[#1e2a38] pb-1.5">
                      <span className="text-slate-500">Full Kelly Bet:</span>
                      <span className="text-white font-bold">${fullKellyBet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs border-b border-[#1e2a38] pb-1.5">
                      <span className="text-[#00e676] font-semibold">Half Kelly (recommended):</span>
                      <span className="text-[#00e676] font-bold">${halfKellyBet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Edge:</span>
                      <span className="text-[#00d4ff] font-bold">{edgePct} percentage point</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CHANGE 4: Live X Sentiment & News Tracker */}
            <div className="p-4 rounded-xl bg-[#0d1219]/90 border border-[#1e2a38] backdrop-blur-md space-y-4 font-mono shadow-[0_0_15px_rgba(0,212,255,0.03)]">
              <div className="flex items-center justify-between border-b border-[#1e2a38] pb-2">
                <span className="text-xs font-bold text-[#ff5252] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff5252] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff5252]"></span>
                  </span>
                  Live X Sentiment
                </span>
                <span className="text-[9px] text-slate-500 font-semibold uppercase">
                  Last updated: {lastUpdatedSeconds}s ago
                </span>
              </div>

              {sentimentLoading && !sentimentData ? (
                <div className="flex justify-center items-center py-4 gap-2 text-[10px] text-slate-500">
                  <div className="w-3.5 h-3.5 border-2 border-t-[#ff5252] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                  CONNECTING LIVE GROK SOCIAL FEED...
                </div>
              ) : sentimentError ? (
                <div className="text-[11px] font-bold text-[#ffab40] bg-[#ffab40]/5 border border-[#ffab40]/20 rounded p-3 text-center animate-pulse">
                  Sentiment feed offline
                </div>
              ) : sentimentData && sentimentData.degraded ? (
                <div className="text-[11px] font-bold text-[#ffab40] bg-[#ffab40]/5 border border-[#ffab40]/20 rounded p-3 text-center animate-pulse">
                  Live feed loading...
                </div>
              ) : sentimentData ? (
                <div className="space-y-4 animate-fade-in text-xs">
                  {/* Sentiment score sliding bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                      <span>SENTIMENT SCORE</span>
                      <span className={sentimentData.sentimentScore > 0 ? 'text-[#00e676]' : sentimentData.sentimentScore < 0 ? 'text-[#ff5252]' : 'text-slate-400'}>
                        {sentimentData.sentimentScore > 0 ? `+${sentimentData.sentimentScore}` : sentimentData.sentimentScore}
                      </span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-[#ff5252] via-[#ffab40] to-[#00e676]">
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-slate-900 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] -ml-1.5 transition-all duration-300"
                        style={{ left: `${((sentimentData.sentimentScore + 100) / 200) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-600 font-bold font-mono">
                      <span>-100 BEARISH</span>
                      <span>0 NEUTRAL</span>
                      <span>+100 BULLISH</span>
                    </div>
                  </div>

                  {/* Top 3 X posts cards */}
                  <div className="space-y-2">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Top X Posts</div>
                    {sentimentData.topPosts && sentimentData.topPosts.length > 0 ? (
                      sentimentData.topPosts.slice(0, 3).map((post, idx) => (
                        <div key={idx} className="p-2.5 rounded border border-[#1e2a38] bg-[#080c10]/80 text-[11px] leading-relaxed font-sans text-slate-300 border-l-2 border-l-[#ff5252]/40">
                          "{post}"
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] text-slate-500 italic">No posts scraped recently.</div>
                    )}
                  </div>

                  {/* News Headlines */}
                  <div className="space-y-2">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Breaking News Headlines</div>
                    {sentimentData.newsHeadlines && sentimentData.newsHeadlines.length > 0 ? (
                      <ul className="space-y-1.5 list-disc pl-4 text-slate-400 font-sans text-[11px]">
                        {sentimentData.newsHeadlines.map((headline, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {headline}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[10px] text-slate-500 italic">No news headlines compiled.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-xs text-slate-500 font-bold tracking-wider font-mono gap-2">
            <div className="w-5 h-5 border-2 border-t-[#00d4ff] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
            INITIALIZING REPORT...
          </div>
        )}
      </div>

      {/* SECTION 7: Stationary Disclaimer Footer */}
      <div className="p-4 border-t border-[#1e2a38] bg-[#0d1219]/60 shrink-0 text-slate-500 text-[10px] leading-relaxed font-sans select-none text-center">
        NFA — This is not financial advice. Prediction markets carry significant risk. <br />
        Always do your own research. DYOR as always.
      </div>
    </div>
  );
}
