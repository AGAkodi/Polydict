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
  marketSentiment?: any;
}

const STORAGE_KEY_PREFIX = 'analysis_';
const CACHE_TTL = 86400000; // 24 hours in ms

const getConciseReasoning = (text: string) => {
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  return sentences.slice(0, 3).join("").trim();
};

function getMarketHealthScore(market: any, analysis: any): number {
  let score = 35;

  if (market.volume > 1_000_000) score += 20;
  else if (market.volume > 500_000) score += 14;
  else if (market.volume > 100_000) score += 8;
  else if (market.volume > 10_000) score += 3;

  const edgePct = Math.abs((analysis?.edge ?? 0) * 100);
  if (edgePct >= 20) score += 20;
  else if (edgePct >= 15) score += 14;
  else if (edgePct >= 10) score += 10;
  else if (edgePct >= 5) score += 5;

  const daysLeft = market.endDate
    ? Math.max(0, (new Date(market.endDate).getTime() - Date.now()) / 86400000)
    : 999;
  if (daysLeft <= 7) score += 15;
  else if (daysLeft <= 30) score += 10;
  else if (daysLeft <= 90) score += 5;

  const sentiment = analysis?.signals?.sentiment ?? analysis?.grokSignals?.sentiment;
  if (
    (analysis?.verdict === "YES" && sentiment === "bull") ||
    (analysis?.verdict === "NO" && sentiment === "bear")
  ) score += 10;

  return Math.max(0, Math.min(100, score));
}

export default function PredictionCard({ 
  market, 
  livePrices, 
  pricesError, 
  onAnalysisLoaded, 
  triggerReanalyzeCount,
  onAskAI,
  marketSentiment
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
      <div 
        className="h-full flex flex-col items-center justify-center p-8 text-center select-none animate-fade-in font-mono"
        style={{
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div className="max-w-md space-y-4">
          <div 
            style={{
              margin: '0 auto',
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius)',
              background: 'rgba(255, 82, 82, 0.05)',
              border: '1px solid rgba(255, 82, 82, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--red)',
              fontSize: '24px',
              fontWeight: 'bold',
            }}
            className="animate-pulse"
          >
            ERR
          </div>
          <div className="space-y-2">
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--red)', margin: '16px 0 8px 0' }}>Polymarket CLOB API Offline</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', fontFamily: 'var(--font-sans)', margin: 0 }}>
              Live price feeds could not be retrieved from the Polymarket CLOB order book. Telemetry operations are paused to prevent stale or simulated data usage.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div 
        className="h-full flex flex-col relative select-text"
        style={{
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none animate-fade-in font-mono">
          <div className="max-w-md space-y-4">
            <div 
              style={{
                margin: '0 auto',
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius)',
                background: 'var(--accent-glow)',
                border: '1px solid var(--accent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                fontSize: '24px',
                fontWeight: 'bold',
              }}
              className="animate-pulse"
            >
              PD
            </div>
            <div className="space-y-2">
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '16px 0 8px 0' }}>PolyDict Intelligence Standby</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', fontFamily: 'var(--font-sans)', margin: 0 }}>
                Select any active Polymarket prediction contract from the left sidebar to initialize real-time AI analyst resolution.
              </p>
            </div>
          </div>
        </div>
        <div 
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.2)',
            color: 'var(--text-muted)',
            fontSize: '10px',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
            lineHeight: '1.6',
            userSelect: 'none',
          }}
        >
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
    <div 
      className="h-full flex flex-col relative select-text"
      style={{
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Scanning loading overlay */}
      {loading && (
        <div 
          className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 space-y-6 select-none font-mono"
          style={{
            background: 'rgba(11, 15, 20, 0.96)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div className="relative flex items-center justify-center">
            <div 
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: '2px solid transparent',
                borderTopColor: loadingPhase === 'grok' ? 'var(--amber)' : 'var(--accent)',
                animation: 'spin 1s linear infinite',
                boxShadow: loadingPhase === 'grok' 
                  ? '0 0 15px rgba(255, 183, 77, 0.2)' 
                  : '0 0 15px rgba(0, 209, 255, 0.2)',
              }}
            />
            <div 
              style={{
                position: 'absolute',
                fontSize: '10px',
                fontWeight: 'bold',
                color: 'var(--text-secondary)',
              }}
            >
              {loadingPhase === 'grok' ? 'X-AI' : 'CLAUDE'}
            </div>
          </div>
          <div className="text-center max-w-xs space-y-3">
            <div 
              style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: loadingPhase === 'grok' ? 'var(--amber)' : 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
              className="animate-pulse"
            >
              {loadingPhase === 'grok' ? 'PHASE 1: SOCIAL SIGNAL SCRAPE' : 'PHASE 2: DEEP FORECAST ANALYSIS'}
            </div>
            <p 
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-sans)',
                margin: 0,
              }}
            >
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span 
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--accent-border)',
                background: 'var(--accent-glow)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {market.category}
            </span>
            <span 
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                background: getCountdownStyles(countdown.severity).includes('bg-[#ff5252]/5') ? 'var(--red-glow)' : getCountdownStyles(countdown.severity).includes('bg-[#ffab40]/5') ? 'var(--amber-glow)' : 'rgba(255,255,255,0.04)',
                borderColor: getCountdownStyles(countdown.severity).includes('bg-[#ff5252]/5') ? 'rgba(255, 82, 82, 0.2)' : getCountdownStyles(countdown.severity).includes('bg-[#ffab40]/5') ? 'rgba(255, 183, 77, 0.2)' : 'var(--border)',
                color: getCountdownStyles(countdown.severity).includes('text-[#ff5252]') ? 'var(--red)' : getCountdownStyles(countdown.severity).includes('text-[#ffab40]') ? 'var(--amber)' : 'var(--text-secondary)',
              }}
            >
              {countdown.label}
            </span>
          </div>

          <h2 
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#FFFFFF',
              lineHeight: '1.4',
              margin: '0',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {market.question}
          </h2>

          <div 
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '12px',
            }}
          >
            <span>VOLUME: <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>${market.volume.toLocaleString()}</strong></span>
            <span>LIQUIDITY: <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>${market.liquidity.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Prediction Results block */}
        {error ? (
          error.includes('API_KEY') || error.includes('credentials') || error.includes('API key') ? (
            <div 
              style={{
                padding: '20px',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(255, 82, 82, 0.2)',
                background: 'rgba(255, 82, 82, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                fontFamily: 'var(--font-mono)',
              }}
              className="animate-fade-in"
            >
              <div 
                style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'var(--red)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid rgba(255, 82, 82, 0.1)',
                  paddingBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span className="animate-pulse">⚠</span>
                <span>API Configuration Required</span>
              </div>
              
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', lineHeight: '1.6', margin: 0 }}>
                PolyDict runs in a strict <strong style={{ color: 'var(--accent)' }}>live-only telemetry mode</strong>. To execute real-time social sentiment scraping via Grok and dual-model analyst reasoning via Claude, you must define your API keys in your local environment.
              </p>

              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: 'var(--bg-secondary)',
                  padding: '14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                }}
              >
                <div 
                  style={{
                    fontWeight: 'bold',
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>Workspace Setup Steps</span>
                  <span style={{ fontSize: '9px', background: 'var(--accent-glow)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px' }}>.env.local</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>1.</span>
                    <p style={{ fontFamily: 'var(--font-sans)', margin: 0 }}>
                      Open <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '10px', background: 'var(--bg-primary)', padding: '2px 4px', border: '1px solid var(--border)', borderRadius: '4px' }}>.env.local</strong> in your project root folder.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>2.</span>
                    <p style={{ fontFamily: 'var(--font-sans)', margin: 0 }}>
                      Define the following variables with your credentials (no quotes or spaces):
                    </p>
                  </div>
                  <pre 
                    style={{
                      fontSize: '10px',
                      background: 'var(--bg-primary)',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      color: 'var(--green)',
                      overflowX: 'auto',
                      userSelect: 'all',
                      lineHeight: '1.5',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'bold',
                      margin: 0,
                    }}
                  >
{`ANTHROPIC_API_KEY=your-anthropic-key-here
GROQ_API_KEY=your-groq-key-here
XAI_API_KEY=your-xai-key-here`}
                  </pre>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>3.</span>
                    <p style={{ fontFamily: 'var(--font-sans)', margin: 0 }}>
                      Save the file and click the retry button below to re-initiate telemetry.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', paddingTop: '4px' }}>
                <button
                  onClick={() => runAnalysis(market, true)}
                  style={{
                    padding: '10px 16px',
                    background: 'rgba(255, 82, 82, 0.1)',
                    border: '1px solid var(--red)',
                    color: 'var(--red)',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: '0 0 10px rgba(255, 82, 82, 0.1)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 82, 82, 0.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 82, 82, 0.1)'}
                >
                  RETRY Live Resolution
                </button>
              </div>
            </div>
          ) : (
            <div 
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255, 82, 82, 0.2)',
                background: 'rgba(255, 82, 82, 0.05)',
                fontSize: '12px',
                color: 'var(--red)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>SYSTEM ERROR: PIPELINE DEPLOYMENT FAILURE</div>
              <div style={{ fontSize: '11px', lineHeight: '1.6', fontFamily: 'var(--font-sans)' }}>{error}</div>
              <button
                onClick={() => runAnalysis(market, true)}
                style={{
                  marginTop: '4px',
                  padding: '6px 12px',
                  background: 'rgba(255, 82, 82, 0.1)',
                  border: '1px solid rgba(255, 82, 82, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--red)',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 82, 82, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 82, 82, 0.1)'}
              >
                RETRY RESOLUTION
              </button>
            </div>
          )
        ) : analysis ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
            {/* Price Drift Warning Banner */}
            {priceDrift > 0.03 && (
              <div 
                style={{
                  padding: '10px 14px',
                  background: 'var(--amber-glow)',
                  border: '1px solid rgba(255, 183, 77, 0.15)',
                  borderLeft: '4px solid var(--amber)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--amber)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
                className="animate-fade-in shrink-0"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    Odds moved {(priceDrift * 100).toFixed(1)} percentage point since scan
                  </span>
                </div>
                <button 
                  onClick={reAnalyze}
                  style={{
                    padding: '4px 8px',
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    border: '1px solid rgba(255, 183, 77, 0.3)',
                    background: 'rgba(255, 183, 77, 0.1)',
                    color: 'var(--amber)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 183, 77, 0.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 183, 77, 0.1)'}
                >
                  Re-analyze
                </button>
              </div>
            )}

            {/* STUNNING PROMINENT VERDICT BANNER */}
            <div 
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
              }}
            >
              {/* Verdict header banner */}
              <div 
                style={{
                  padding: '16px 20px',
                  background: analysis.verdict === 'YES' ? 'var(--green-glow)' :
                             analysis.verdict === 'NO' ? 'var(--red-glow)' : 'var(--amber-glow)',
                  borderBottom: analysis.verdict === 'YES' ? '1px solid rgba(0, 230, 118, 0.2)' :
                               analysis.verdict === 'NO' ? '1px solid rgba(255, 82, 82, 0.2)' : '1px solid rgba(255, 183, 77, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
                className={
                  analysis.verdict === 'YES' ? 'animate-pulse-yes' :
                  analysis.verdict === 'NO' ? 'animate-pulse-no' : 'animate-pulse-skip'
                }
              >
                <span 
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: analysis.verdict === 'YES' ? 'var(--green)' :
                               analysis.verdict === 'NO' ? 'var(--red)' : 'var(--amber)',
                    boxShadow: `0 0 8px ${
                      analysis.verdict === 'YES' ? 'var(--green)' :
                      analysis.verdict === 'NO' ? 'var(--red)' : 'var(--amber)'
                    }`,
                    display: 'inline-block',
                  }} 
                />
                <h3 
                  style={{
                    fontSize: '28px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.02em',
                    color: analysis.verdict === 'YES' ? 'var(--green)' :
                           analysis.verdict === 'NO' ? 'var(--red)' : 'var(--amber)',
                    margin: 0,
                    lineHeight: 1,
                  }}
                >
                  {analysis.verdict}
                </h3>
              </div>

              {/* Banner content */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Dynamic Explanation Sentence */}
                <p 
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6',
                    margin: 0,
                  }}
                >
                  "{
                    analysis.verdict === 'YES'
                      ? `The market prices this at ${yesOdds}%. PolyDict estimates ${confidencePct}% probability — a ${Math.abs(edgePct)} percentage point edge worth taking.`
                      : analysis.verdict === 'NO'
                      ? `The market is overpricing this at ${yesOdds}%. PolyDict puts true odds at ${confidencePct}% — lean NO.`
                      : `Edge is only ${Math.abs(edgePct)} percentage point — too thin to act on. Monitor and revisit.`
                  }"
                </p>

                {/* WHY Label and Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div 
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      fontWeight: '600',
                      letterSpacing: '0.14em',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    WHY {analysis.verdict}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', fontFamily: 'var(--font-sans)', margin: 0 }}>
                    {analysis.summary}
                  </p>
                </div>

                {/* Side-by-side Progress Bars */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>CONFIDENCE</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{confidencePct}%</span>
                    </div>
                    <div 
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        height: '3px',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        width: '100%',
                      }}
                    >
                      <div 
                        style={{
                          height: '100%',
                          background: analysis.verdict === 'YES' ? 'var(--green)' :
                                     analysis.verdict === 'NO' ? 'var(--red)' : 'var(--amber)',
                          width: `${confidencePct}%`,
                          borderRadius: '2px',
                          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        }} 
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>MARKET ODDS</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{yesOdds}%</span>
                    </div>
                    <div 
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        height: '3px',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        width: '100%',
                      }}
                    >
                      <div 
                        style={{
                          height: '100%',
                          background: 'var(--accent)',
                          width: `${yesOdds}%`,
                          borderRadius: '2px',
                          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {marketSentiment?.polymarketSentiment && (
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}>
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  fontWeight: '600',
                  letterSpacing: '0.14em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  marginRight: 0,
                  marginLeft: 0,
                  marginTop: 0,
                }}>
                  Polymarket Crowd vs PolyDict Agent
                </p>

                {/* Crowd sentiment bar */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                      CROWD SENTIMENT
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {((market.sentimentRatio ?? 0.5) * 100).toFixed(0)}% BULL
                    </span>
                  </div>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(market.sentimentRatio ?? 0.5) * 100}%`,
                      background: (market.sentimentRatio ?? 0.5) > 0.5 ? 'var(--green)' : 'var(--red)',
                      transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                      boxShadow: (market.sentimentRatio ?? 0.5) > 0.5 ? '0 0 6px rgba(0,230,118,0.4)' : '0 0 6px rgba(255,82,82,0.4)',
                    }} />
                  </div>
                </div>

                {/* Agent confidence bar */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                      AGENT CONFIDENCE
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)' }}>
                      {((analysis?.confidence ?? 0.5) * 100).toFixed(0)}% {analysis?.verdict}
                    </span>
                  </div>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(analysis?.confidence ?? 0.5) * 100}%`,
                      background: 'var(--accent)',
                      transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                      boxShadow: '0 0 6px rgba(0,209,255,0.4)',
                    }} />
                  </div>
                </div>

                {/* Price trend from Polymarket history */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                    24H TREND
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: marketSentiment?.trend === 'rising'
                      ? 'var(--green)'
                      : marketSentiment?.trend === 'falling'
                      ? 'var(--red)'
                      : 'var(--text-muted)',
                  }}>
                    {marketSentiment?.trend === 'rising' ? '↑ Rising'
                      : marketSentiment?.trend === 'falling' ? '↓ Falling'
                      : '→ Flat'}
                  </span>
                  {marketSentiment?.polymarketSentiment?.change24h !== 0 && marketSentiment?.polymarketSentiment?.change24h !== undefined && (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: marketSentiment.polymarketSentiment.change24h > 0 ? 'var(--green)' : 'var(--red)',
                    }}>
                      {marketSentiment.polymarketSentiment.change24h > 0 ? '+' : ''}
                      {(marketSentiment.polymarketSentiment.change24h * 100).toFixed(1)}pp
                    </span>
                  )}
                </div>
              </div>
            )}

            {(() => {
              const healthScore = getMarketHealthScore(market, analysis);
              const barColor = healthScore >= 70 ? "#00e676" : healthScore >= 40 ? "#ffab40" : "#ff5252";
              const label = healthScore >= 70
                ? "Strong signal — high confidence setup"
                : healthScore >= 40
                ? "Moderate signal — size conservatively"
                : "Weak signal — consider skipping";

              return (
                <div className="px-5 py-3 border-b border-[#1e2a38]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
                      Market Health
                    </span>
                    <span className="text-[11px] font-mono font-bold" style={{ color: barColor }}>
                      {healthScore}/100
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1e2a38] rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${healthScore}%`, background: barColor }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">{label}</p>
                </div>
              );
            })()}

            {/* SECTION 3: Why (reasoning condensed) */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div 
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  fontWeight: '600',
                  letterSpacing: '0.14em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                ◈ Analyst Reasoning
              </div>
              <p 
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.7',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {getConciseReasoning(analysis.reasoning)}
              </p>
            </div>

            {/* SECTION 4: Want to know more? Chat link prompt */}
            {onAskAI && (
              <div style={{ display: 'flex', userSelect: 'none' }}>
                <button
                  type="button"
                  onClick={onAskAI}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--green)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent)'}
                >
                  &gt; Ask the AI analyst for scenarios, position sizing, or deeper signals →
                </button>
              </div>
            )}

            {/* SECTION 5: Live Market Pulse Heatmap */}
            <div 
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
              className="animate-fade-in"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span 
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-ping" />
                  Live Market Pulse
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>TELEMETRY</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {/* Momentum Dial */}
                <div 
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price Momentum</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: pulseArrowClass.includes('00e676') ? 'var(--green)' : pulseArrowClass.includes('ff5252') ? 'var(--red)' : 'var(--text-muted)' }}>{pulseArrow}</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: pulseArrowClass.includes('00e676') ? 'var(--green)' : pulseArrowClass.includes('ff5252') ? 'var(--red)' : 'var(--text-muted)' }}>
                      {pulseArrow === '↑' ? 'RISING DRIFT' : pulseArrow === '↓' ? 'DOWNWARD DRIFT' : 'STABLE'}
                    </span>
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                    Drift: {(priceDrift * 100).toFixed(1)} pp from initial scan
                  </span>
                </div>

                {/* Volume Change Dial */}
                <div 
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                    transition: 'all 0.3s',
                  }}
                  className={volDriftClass.includes('00e676') ? 'border-emerald-500/40 bg-emerald-500/5' : volDriftClass.includes('00d4ff') ? 'border-cyan-500/30 bg-cyan-500/5' : ''}
                >
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volume Pulse</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      ${(currentVol || 0).toLocaleString()}
                    </span>
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                    Active contract flow telemetry
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 6: Interactive Kelly Bet Sizer */}
            <div 
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span 
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
                  Kelly Sizer
                </span>
                <span style={{ fontSize: '9px', color: 'var(--accent)', border: '1px solid var(--accent-border)', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                  BET CALCULATOR
                </span>
              </div>

              {/* Bankroll Betting field input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  <span>I WANT TO BET $</span>
                  <span>USD</span>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>$</span>
                  <input 
                    type="number"
                    value={sizerBet}
                    onChange={(e) => setSizerBet(e.target.value)}
                    placeholder="Enter bet size..."
                    style={{
                      width: '100%',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px 8px 24px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-border)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              </div>

              {/* Kelly Betting outputs */}
              <div 
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {!isEdgePositive ? (
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber)', textAlign: 'center', padding: '8px 0' }} className="animate-pulse">
                    No edge detected — Kelly recommends $0
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Full Kelly Bet:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${fullKellyBet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--green)', fontWeight: 500 }}>Half Kelly (recommended):</span>
                      <span style={{ color: 'var(--green)', fontWeight: 600 }}>${halfKellyBet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Edge:</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{edgePct} percentage point</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CHANGE 4: Live X Sentiment & News Tracker */}
            <div 
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span 
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: 'var(--red)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff5252] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff5252]"></span>
                  </span>
                  Live X Sentiment
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                  LAST UPDATED: {lastUpdatedSeconds}s AGO
                </span>
              </div>

              {sentimentLoading && !sentimentData ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 0', gap: '8px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  <div 
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid transparent',
                      borderTopColor: 'var(--red)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} 
                  />
                  CONNECTING LIVE GROK SOCIAL FEED...
                </div>
              ) : sentimentError ? (
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber)', background: 'var(--amber-glow)', border: '1px solid rgba(255, 183, 77, 0.2)', borderRadius: 'var(--radius-sm)', padding: '12px', textAlign: 'center' }} className="animate-pulse">
                  Sentiment feed offline
                </div>
              ) : sentimentData && sentimentData.degraded ? (
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber)', background: 'var(--amber-glow)', border: '1px solid rgba(255, 183, 77, 0.2)', borderRadius: 'var(--radius-sm)', padding: '12px', textAlign: 'center' }} className="animate-pulse">
                  Live feed loading...
                </div>
              ) : sentimentData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in text-xs">
                  {/* Sentiment score sliding bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                      <span>SENTIMENT SCORE</span>
                      <span style={{ color: sentimentData.sentimentScore > 0 ? 'var(--green)' : sentimentData.sentimentScore < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                        {sentimentData.sentimentScore > 0 ? `+${sentimentData.sentimentScore}` : sentimentData.sentimentScore}
                      </span>
                    </div>
                    <div 
                      style={{
                        position: 'relative',
                        height: '2px',
                        width: '100%',
                        borderRadius: '2px',
                        background: 'linear-gradient(to right, var(--red) 0%, var(--amber) 50%, var(--green) 100%)',
                      }}
                    >
                      <div 
                        style={{
                          position: 'absolute',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '10px',
                          height: '10px',
                          background: '#FFFFFF',
                          border: '1px solid var(--bg-primary)',
                          borderRadius: '50%',
                          boxShadow: '0 0 6px rgba(255,255,255,0.8)',
                          marginLeft: '-5px',
                          transition: 'all 0.3s',
                          left: `${((sentimentData.sentimentScore + 100) / 200) * 100}%`,
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      <span>-100 BEARISH</span>
                      <span>0 NEUTRAL</span>
                      <span>+100 BULLISH</span>
                    </div>
                  </div>

                  {/* Top 3 X posts cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top X Posts</div>
                    {sentimentData.topPosts && sentimentData.topPosts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sentimentData.topPosts.slice(0, 3).map((post, idx) => (
                          <div 
                            key={idx} 
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)',
                              borderLeft: '2px solid rgba(255, 82, 82, 0.4)',
                              background: 'rgba(255,255,255,0.01)',
                              fontSize: '11px',
                              lineHeight: '1.5',
                              fontFamily: 'var(--font-sans)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            "{post}"
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No posts scraped recently.</div>
                    )}
                  </div>

                  {/* News Headlines */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Breaking News Headlines</div>
                    {sentimentData.newsHeadlines && sentimentData.newsHeadlines.length > 0 ? (
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px', listStyleType: 'disc', paddingLeft: '16px', margin: 0, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '11px', lineHeight: '1.5' }}>
                        {sentimentData.newsHeadlines.map((headline, idx) => (
                          <li key={idx}>
                            {headline}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No news headlines compiled.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{ height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', gap: '12px' }}>
            <div 
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid transparent',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} 
            />
            INITIALIZING REPORT...
          </div>
        )}
      </div>

      {/* SECTION 7: Stationary Disclaimer Footer */}
      <div 
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.2)',
          color: 'var(--text-muted)',
          fontSize: '10px',
          fontFamily: 'var(--font-sans)',
          textAlign: 'center',
          lineHeight: '1.6',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        NFA — This is not financial advice. Prediction markets carry significant risk. <br />
        Always do your own research. DYOR as always.
      </div>
    </div>
  );
}
