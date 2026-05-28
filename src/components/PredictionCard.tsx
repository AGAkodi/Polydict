import React, { useState, useEffect } from 'react';
import { MergedMarket } from '../utils/polymarket';
import { formatVolume, getCountdown } from '../utils/helpers';
import ConfidenceBar from './ConfidenceBar';
import SignalRow from './SignalRow';

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
}

const STORAGE_KEY_PREFIX = 'analysis_';
const CACHE_TTL = 86400000; // 24 hours in ms

export default function PredictionCard({ 
  market, 
  livePrices, 
  pricesError, 
  onAnalysisLoaded, 
  triggerReanalyzeCount 
}: PredictionCardProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzedAtPrice, setAnalyzedAtPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'grok' | 'claude' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bankroll, setBankroll] = useState<number>(10000);
  const [useHalfKelly, setUseHalfKelly] = useState<boolean>(true);

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
        // Cache corrupted, clear it
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${market.id}`);
      }
    }

    // If not cached or expired, run analysis
    runAnalysis(market);
  }, [market]);

  // Run fresh analysis when manual re-analyze triggers
  useEffect(() => {
    if (market && triggerReanalyzeCount > 0) {
      runAnalysis(market, true);
    }
  }, [triggerReanalyzeCount]);

  const runAnalysis = async (targetMarket: MergedMarket, forceRefetch = false) => {
    setLoading(true);
    setLoadingPhase('grok');
    setError(null);
    try {
      // Phase 1: Call Grok 4.1 Fast social scraping
      const signalsRes = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: targetMarket }),
      });

      if (!signalsRes.ok) {
        throw new Error('Grok signal scraper endpoint failed');
      }

      const signalsData = await signalsRes.json();

      // Phase 2: Call Claude Sonnet 4.6 with market and pre-fetched signals
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

      // Merge and save final results
      const finalResult: AnalysisResult = {
        ...analyzeData,
        grokSignals: signalsData,
      };

      setAnalysis(finalResult);
      setAnalyzedAtPrice(targetMarket.yesPrice);
      onAnalysisLoaded(finalResult);

      // Cache the result
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
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#080c10] border-r border-[#1e2a38] text-center select-none animate-fade-in font-mono">
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
    );
  }

  const currentPrice = livePrices?.[market.conditionId]?.yes ?? market.yesPrice;
  const priceDrift = analyzedAtPrice != null && currentPrice != null
    ? Math.abs(currentPrice - analyzedAtPrice)
    : 0;

  const reAnalyze = () => {
    runAnalysis(market, true);
  };

  const yesOdds = Math.round(currentPrice * 100);
  const countdown = getCountdown(market.endDateIso || market.endDate);

  const getVerdictStyles = (v: string) => {
    switch (v) {
      case 'YES':
        return 'border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676]';
      case 'NO':
        return 'border-[#ff5252]/30 bg-[#ff5252]/10 text-[#ff5252]';
      case 'SKIP':
      default:
        return 'border-[#ffab40]/30 bg-[#ffab40]/10 text-[#ffab40]';
    }
  };

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

  const edgeVal = analysis?.edge || 0;
  const oddsVal = currentPrice || 0.50;
  const rawKelly = edgeVal > 0 && oddsVal > 0 ? (edgeVal / oddsVal) : 0;
  const kellyMultiplier = useHalfKelly ? 0.5 : 1.0;
  const allocatedKelly = Math.min(1.0, Math.max(0, rawKelly * kellyMultiplier));
  const positionAmount = bankroll * allocatedKelly;

  return (
    <div className="h-full flex flex-col bg-[#080c10] border-r border-[#1e2a38] overflow-y-auto no-scrollbar relative select-text">
      {/* Scanning loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#080c10]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 space-y-6 select-none font-mono">
          {/* Animated Spinner with Cyberpunk Cyan/Amber glow */}
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

      {/* Main card viewport */}
      <div className="p-5 space-y-6">
        {/* Header Metadata */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Tag */}
            <span className="px-2 py-0.5 rounded border border-[#00d4ff]/20 bg-[#00d4ff]/5 text-[10px] font-bold text-[#00d4ff] uppercase tracking-wider font-mono">
              {market.category}
            </span>
            {/* Countdown Badge */}
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
              <div className="p-3.5 rounded border border-l-4 border-[#ffab40]/40 border-l-[#ffab40] bg-[#ffab40]/[0.03] text-xs font-mono text-[#ffab40] flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span>⚠</span>
                  <span className="font-semibold text-slate-200">
                    Odds moved {(priceDrift * 100).toFixed(1)}pp since this analysis was run
                  </span>
                </div>
                <button 
                  onClick={reAnalyze}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-[#ffab40]/40 bg-[#ffab40]/10 rounded hover:bg-[#ffab40]/20 text-[#ffab40] cursor-pointer transition-all active:scale-[0.97] shrink-0"
                >
                  Re-analyze now
                </button>
              </div>
            )}

            {/* Verdict Box & Re-analyze row */}
            <div className="flex items-center justify-between gap-4 p-5 rounded-xl bg-[#0d1219] border border-[#1e2a38]">
              <div className="space-y-1 font-mono">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PolyDict Verdict</div>
                <div className={`px-4 py-1.5 rounded border text-sm font-bold tracking-widest text-center ${getVerdictStyles(analysis.verdict)}`}>
                  {analysis.verdict}
                </div>
              </div>

              <div className="space-y-1 text-right font-mono">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Market Odds (YES)</div>
                <div className="text-base font-bold text-[#00d4ff]">{yesOdds}%</div>
              </div>

              {/* Re-analyze Button */}
              <button
                onClick={() => runAnalysis(market, true)}
                className="px-4 py-2 rounded-sm border border-[#00d4ff] bg-[#00d4ff]/10 font-bold font-mono text-xs text-[#00d4ff] hover:bg-[#00d4ff]/20 active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_10px_rgba(0,212,255,0.15)]"
              >
                Re-Analyze
              </button>
            </div>

            {/* Probability Bars */}
            <ConfidenceBar
              confidence={analysis.confidence}
              marketOdds={currentPrice}
              edge={analysis.edge}
            />

            {/* Live Telemetry & Sentiment Heatmap */}
            <div className="p-4 rounded-xl bg-[#0d1219]/90 border border-[#1e2a38] backdrop-blur-md space-y-4 font-mono shadow-[0_0_15px_rgba(0,212,255,0.03)] animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1e2a38] pb-2">
                <span className="text-xs font-bold text-[#00d4ff] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-ping" />
                  [Live Telemetry Heatmap]
                </span>
                <span className="text-[9px] text-slate-500 font-semibold uppercase">Real-Time Dials</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Dial 1: Price Drift & Momentum */}
                <div className="p-3 rounded-lg bg-[#080c10] border border-[#1e2a38]/80 flex flex-col justify-between space-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Price Momentum</span>
                  <div className="flex items-center gap-2">
                    {priceDrift === 0 ? (
                      <>
                        <span className="text-slate-400 text-sm font-bold">──</span>
                        <span className="text-xs font-bold text-slate-300">STABLE</span>
                      </>
                    ) : currentPrice > (analyzedAtPrice || 0) ? (
                      <>
                        <span className="text-[#00e676] text-lg font-bold animate-pulse">▲</span>
                        <span className="text-xs font-bold text-[#00e676]">UPWARD DRIFT</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[#ff5252] text-lg font-bold animate-pulse">▼</span>
                        <span className="text-xs font-bold text-[#ff5252]">DOWNWARD DRIFT</span>
                      </>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 font-sans">
                    Drift: {priceDrift === 0 ? '0.0' : `${(priceDrift * 100).toFixed(1)}`}pp from initial scan
                  </span>
                </div>

                {/* Dial 2: Grok Social Power */}
                <div className="p-3 rounded-lg bg-[#080c10] border border-[#1e2a38]/80 flex flex-col justify-between space-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Grok Social Power</span>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                      <span>METER</span>
                      <span className={
                        analysis.grokSignals?.sentiment === 'bull' ? 'text-[#00e676]' :
                        analysis.grokSignals?.sentiment === 'bear' ? 'text-[#ff5252]' : 'text-[#ffab40]'
                      }>
                        {analysis.grokSignals?.sentiment?.toUpperCase() || 'NEUTRAL'}
                      </span>
                    </div>
                    {/* Glowing Power Bar */}
                    <div className="h-1.5 w-full bg-[#1e2a38] rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          analysis.grokSignals?.sentiment === 'bull' ? 'bg-[#00e676] shadow-[0_0_8px_#00e676]' :
                          analysis.grokSignals?.sentiment === 'bear' ? 'bg-[#ff5252] shadow-[0_0_8px_#ff5252]' :
                          'bg-[#ffab40] shadow-[0_0_8px_#ffab40]'
                        }`}
                        style={{ 
                          width: 
                            analysis.grokSignals?.sentiment === 'bull' ? '85%' :
                            analysis.grokSignals?.sentiment === 'bear' ? '25%' : '55%'
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 font-sans">
                    Activity: {analysis.grokSignals?.momentum || 'active'} flow
                  </span>
                </div>

                {/* Dial 3: Catalyst Velocity */}
                <div className="p-3 rounded-lg bg-[#080c10] border border-[#1e2a38]/80 flex flex-col justify-between space-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Catalyst Timeline</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      analysis.signals.some(s => s.direction === 'bull') 
                        ? 'border border-[#00e676]/20 bg-[#00e676]/10 text-[#00e676]'
                        : 'border border-[#ffab40]/20 bg-[#ffab40]/10 text-[#ffab40]'
                    }`}>
                      {analysis.signals.length} CATALYSTS
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-sans truncate">
                    Latest: {analysis.signals[0]?.text || 'No updates'}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Kelly Position Sizer Simulator */}
            <div className="p-4 rounded-xl bg-[#0d1219]/90 border border-[#1e2a38] backdrop-blur-md space-y-4 font-mono shadow-[0_0_15px_rgba(0,212,255,0.03)] animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1e2a38] pb-2">
                <span className="text-xs font-bold text-[#00d4ff] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
                  [Kelly Position Sizer Simulator]
                </span>
                <span className="text-[9px] text-[#00d4ff] font-bold border border-[#00d4ff]/20 bg-[#00d4ff]/5 px-1.5 py-0.5 rounded">
                  Live Odds Sizing
                </span>
              </div>

              {/* Sizer Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bankroll Input & Presets */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span>TRADING BANKROLL</span>
                    <span className="text-slate-500">USD</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input 
                      type="number"
                      value={bankroll}
                      onChange={(e) => setBankroll(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#080c10] border border-[#1e2a38] rounded p-2 pl-7 text-xs font-bold text-slate-200 focus:outline-none focus:border-[#00d4ff] transition-all"
                    />
                  </div>
                  {/* Bankroll Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {[1000, 5000, 10000, 25000].map((val) => (
                      <button
                        key={val}
                        onClick={() => setBankroll(val)}
                        className={`px-2 py-0.5 rounded border text-[9px] font-bold transition-all ${
                          bankroll === val 
                            ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff]' 
                            : 'border-[#1e2a38] bg-[#080c10] text-slate-500 hover:border-slate-600 hover:text-slate-300'
                        }`}
                      >
                        ${val.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Half/Full Kelly Toggle */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span>RISK PROFILE</span>
                    <span className="text-slate-500">Multiplier</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-[34px]">
                    <button
                      onClick={() => setUseHalfKelly(true)}
                      className={`flex items-center justify-center rounded border text-xs font-bold transition-all ${
                        useHalfKelly 
                          ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff] shadow-[0_0_10px_rgba(0,212,255,0.05)]' 
                          : 'border-[#1e2a38] bg-[#080c10] text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      HALF KELLY (0.5x)
                    </button>
                    <button
                      onClick={() => setUseHalfKelly(false)}
                      className={`flex items-center justify-center rounded border text-xs font-bold transition-all ${
                        !useHalfKelly 
                          ? 'border-[#ffab40] bg-[#ffab40]/10 text-[#ffab40] shadow-[0_0_10px_rgba(255,171,64,0.05)]' 
                          : 'border-[#1e2a38] bg-[#080c10] text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      FULL KELLY (1.0x)
                    </button>
                  </div>
                  <div className="text-[9px] text-slate-500 font-sans leading-tight">
                    {useHalfKelly 
                      ? 'Recommended for downside variance mitigation.' 
                      : 'High-variance sizing targeting maximum growth speed.'}
                  </div>
                </div>
              </div>

              {/* Sizer Outputs */}
              <div className="p-3.5 rounded-lg bg-[#080c10] border border-[#1e2a38] space-y-3.5">
                <div className="grid grid-cols-2 gap-4 divide-x divide-[#1e2a38]">
                  {/* Target Allocation */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Target Allocation</span>
                    <div className="text-lg font-bold text-white">
                      {(allocatedKelly * 100).toFixed(2)}%
                    </div>
                  </div>

                  {/* Position Dollar Amount */}
                  <div className="space-y-1 pl-4">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Position Size</span>
                    <div className={`text-lg font-bold ${allocatedKelly > 0 ? 'text-[#00e676]' : 'text-slate-400'}`}>
                      ${positionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Progress Bar representation */}
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-[#1e2a38] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        allocatedKelly > 0 ? 'bg-[#00e676]' : 'bg-slate-700'
                      }`}
                      style={{ width: `${allocatedKelly * 100}%` }}
                    />
                  </div>
                </div>

                {/* Math Details */}
                <div className="text-[9px] text-slate-500 font-sans border-t border-[#1e2a38]/60 pt-2 flex items-center justify-between">
                  <span>Sizing Formula: <code>(Edge / Odds) * Risk</code></span>
                  {allocatedKelly > 0 ? (
                    <span className="text-slate-400">
                      ({edgeVal.toFixed(3)} / {oddsVal.toFixed(2)}) * {kellyMultiplier} = {(allocatedKelly * 100).toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-[#ff5252] font-semibold">No favorable YES edge available</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Summary Take */}
            <div className="space-y-2 select-text font-mono">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">[Summary Analysis]</h3>
              <p className="text-xs text-slate-300 leading-relaxed italic bg-[#0d1219] p-4 rounded border border-[#1e2a38] font-sans">
                "{analysis.summary}"
              </p>
            </div>

            {/* Analyst Rationale */}
            <div className="space-y-2 select-text font-mono">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">[Analyst Rationale]</h3>
              <div className="text-xs text-slate-300 leading-relaxed font-sans bg-[#0d1219] p-4 rounded border border-[#1e2a38] space-y-1 select-text">
                {analysis.reasoning}
              </div>
            </div>

            {/* Social Signal Strip */}
            {analysis.grokSignals && (
              <div className="p-4 rounded border border-[#ffab40]/20 bg-[#ffab40]/[0.02] space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-[#ffab40]/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#ffab40] font-bold uppercase tracking-wider">
                      [xAI Grok-4.1 Social Stream]
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#ffab40]/30 bg-[#ffab40]/10 text-[#ffab40] font-bold uppercase">
                      SENTIMENT: {analysis.grokSignals.sentiment}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#ffab40]/30 bg-[#ffab40]/10 text-[#ffab40] font-bold uppercase">
                      MOMENTUM: {analysis.grokSignals.momentum}
                    </span>
                  </div>
                </div>
                
                {analysis.grokSignals.keyPosts && analysis.grokSignals.keyPosts.length > 0 ? (
                  <div className="space-y-2.5">
                    {analysis.grokSignals.keyPosts.slice(0, 2).map((post: string, i: number) => (
                      <div key={i} className="text-[11px] text-slate-300 leading-relaxed pl-3.5 border-l-2 border-[#ffab40]/30 italic font-sans">
                        "{post}"
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 font-sans">No social sentiment posts scraped.</div>
                )}
              </div>
            )}

            {/* Key Market Signals */}
            <div className="space-y-2.5 font-mono">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">[Live Sentiment & News Signals]</h3>
              <div className="space-y-2">
                {analysis.signals.map((sig, idx) => (
                  <SignalRow key={idx} signal={sig} />
                ))}
              </div>
            </div>

            {/* Tail Risk uncertainty notice */}
            <div className="p-4 rounded border border-[#ffab40]/10 bg-[#ffab40]/[0.02] select-text space-y-1.5 font-mono">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#ffab40] tracking-wider uppercase">
                <span>⚠</span>
                <span>Tail-Risk Analysis</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                {analysis.risk}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-xs text-slate-500 font-bold tracking-wider font-mono gap-2">
            <div className="w-5 h-5 border-2 border-t-[#00d4ff] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
            INITIALIZING REPORT...
          </div>
        )}
      </div>
    </div>
  );
}

