'use strict';

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import MarketScanner from '../components/MarketScanner';
import PredictionCard from '../components/PredictionCard';
import ChatPanel from '../components/ChatPanel';
import GlobalChat from '../components/GlobalChat';
import LeftNav from '../components/LeftNav';
import CategoryTabs from '../components/CategoryTabs';
import { MergedMarket } from '../utils/polymarket';
import { formatTimestamp } from '../utils/helpers';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('API fetch failure');
  return res.json();
});

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedMarket, setSelectedMarket] = useState<MergedMarket | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<any>(null);
  const [chatFocusTrigger, setChatFocusTrigger] = useState(0);
  const [reanalyzeCount, setReanalyzeCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>('--:--:--');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Setup SWR for markets metadata — refresh every 24h (86400000 ms)
  const { data: markets = [], error: marketsError, mutate } = useSWR<MergedMarket[]>(
    `/api/markets?category=${activeCategory}`,
    fetcher,
    {
      refreshInterval: 86400000,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      onSuccess: () => {
        // Update the timestamp on every successful fetch to show the active feed status
        setLastUpdated(formatTimestamp(new Date()));
      },
    }
  );

  // Setup SWR for live prices — refresh every 10 seconds (10000 ms)
  const { data: livePrices, error: pricesError, mutate: mutatePrices } = useSWR<Record<string, { yes: number; no: number; vol: number; spread: number; liquidity: number; change1h: number }>>(
    '/api/prices',
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  // Market sentiment — fetch when market selected, refresh every 60 seconds
  const { data: marketSentiment } = useSWR(
    selectedMarket
      ? `/api/market-sentiment?conditionId=${selectedMarket.conditionId}&slug=${selectedMarket.slug}`
      : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  // Merge live prices into market list in-memory — enrichedMarkets is the single source of truth
  const enrichedMarkets = useMemo(() => {
    if (!markets) return [];
    return markets.map((m: any) => {
      const live = livePrices?.[m.conditionId];
      if (!live) return m;
      return {
        ...m,
        yesPrice:  live.yes,
        noPrice:   live.no,
        volume:    live.vol,
        spread:    live.spread,
        liquidity: live.liquidity,
      };
    });
  }, [markets, livePrices]);

  // Run cleanup once on page load (mount)
  useEffect(() => {
    clearStaleLocalStorageAnalyses();
  }, []);

  // Auto-select the featured prediction of the day (highest volume/trending) when the list loads
  useEffect(() => {
    if (enrichedMarkets && enrichedMarkets.length > 0) {
      // Find the trending market (highest volume) to serve as our Featured Prediction of the Day
      const sortedByVolume = [...enrichedMarkets].sort((a, b) => (b.volume || 0) - (a.volume || 0));
      const trendingMarket = sortedByVolume[0] || enrichedMarkets[0];
      
      const exists = enrichedMarkets.find((m) => m.id === selectedMarket?.id);
      if (!selectedMarket || !exists) {
        setSelectedMarket(trendingMarket);
      } else {
        // Keep the selected market updated with the latest live price data
        const updated = enrichedMarkets.find((m) => m.id === selectedMarket.id);
        if (updated) {
          setSelectedMarket(updated);
        }
      }
    } else {
      setSelectedMarket(null);
    }
  }, [enrichedMarkets]);

  // Handle manual Cache-Busting Refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/markets/refresh?category=${activeCategory}`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Refresh failed');
      }

      const data = await res.json();

      // Bust the client-side SWR cache immediately with fresh data
      mutate(data.markets, false);
      mutatePrices(); // Also trigger live prices refresh immediately
      setLastUpdated(formatTimestamp(new Date()));

      // Proactively clear stale localStorage analyses older than 24 hours
      clearStaleLocalStorageAnalyses();

      // If the currently selected market is still in the refreshed list, maintain selection
      if (selectedMarket) {
        const freshSelected = data.markets.find((m: MergedMarket) => m.id === selectedMarket.id);
        if (freshSelected) {
          setSelectedMarket(freshSelected);
        } else if (data.markets.length > 0) {
          setSelectedMarket(data.markets[0]);
        }
      }
    } catch (err) {
      console.error('Manual refresh cache bust failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Iterates localStorage and clears analytical data older than 24h
  const clearStaleLocalStorageAnalyses = () => {
    const prefix = 'analysis_';
    const cutoff = Date.now() - 86400000; // 24 hours ago
    
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const item = localStorage.getItem(key);
          if (item) {
            const { timestamp } = JSON.parse(item);
            if (timestamp < cutoff) {
              keysToRemove.push(key);
            }
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      console.log(`Cleared ${keysToRemove.length} stale analytical caches from local storage.`);
    } catch (err) {
      console.error('Failed to clean local storage caches:', err);
    }
  };

  const handleSelectMarket = (market: MergedMarket) => {
    setSelectedMarket(market);
    setActiveAnalysis(null);
  };

  const handleAnalysisLoaded = (analysis: any) => {
    setActiveAnalysis(analysis);
  };

  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-primary)] bg-grid-pattern relative">
      {/* Global Header Bar */}
      <div style={{
        height: '48px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
      }}>
        {/* Left side: Logo — pulsing green dot + POLYDICT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e676] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00e676]"></span>
          </span>
          <span className="font-mono" style={{
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--accent)',
          }}>
            POLYDICT
          </span>
        </div>

        {/* Center: PREDICTION INTELLIGENCE TERMINAL */}
        <div className="font-mono" style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          letterSpacing: '0.2em',
        }}>
          PREDICTION INTELLIGENCE TERMINAL
        </div>

        {/* Right side: Last updated + Manual Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="font-mono" style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
          }}>
            Last updated: {lastUpdated}
          </span>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease-in-out',
            }}
            onMouseEnter={(e) => {
              if (!isRefreshing) {
                e.currentTarget.style.borderColor = 'var(--accent-border)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.background = 'var(--accent-glow)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRefreshing) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <svg className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '12px', height: '12px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M21 3v5h-5" />
            </svg>
            {isRefreshing ? 'REFRESHING' : 'REFRESH'}
          </button>
        </div>
      </div>

      {/* Top Live Ticker Bar */}
      <div className="h-8 bg-[#0b0f15] border-b border-[#1e2a38] flex items-center overflow-hidden select-none text-[10px] font-mono text-slate-400 px-4 shrink-0 relative z-30">
        <div className="flex items-center gap-1.5 text-[#00d4ff] font-bold uppercase tracking-wider text-[9px] shrink-0 border-r border-[#1e2a38] pr-4 bg-[#0b0f15] z-10 h-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4ff] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d4ff]"></span>
          </span>
          Live desk stream
        </div>
        
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          <div className="animate-marquee whitespace-nowrap flex items-center">
            {enrichedMarkets && enrichedMarkets.length > 0 ? (
              [...enrichedMarkets, ...enrichedMarkets].map((m: MergedMarket, idx: number) => {
                const yesPct = Math.round(m.yesPrice * 100);
                return (
                  <div 
                    key={idx} 
                    onClick={() => handleSelectMarket(m)}
                    className="inline-flex items-center gap-2.5 px-4 py-1.5 hover:bg-[#111820]/80 border border-transparent hover:border-[#1e2a38]/40 hover:text-white rounded-sm transition-all cursor-pointer select-none text-[10px] font-semibold"
                  >
                    <span className="text-slate-200 truncate max-w-[150px]">{m.question}</span>
                    <span className={`font-bold ${yesPct >= 50 ? 'text-[#00e676]' : 'text-[#ff5252]'}`}>{yesPct}% YES</span>
                    <span className="text-slate-500 font-semibold">VOL: ${(m.volume || 0).toLocaleString(undefined, {notation: 'compact', compactDisplay: 'short'})}</span>
                  </div>
                );
              })
            ) : (
              <span className="text-slate-500 italic px-4">Initializing global Polymarket order books telemetry...</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Panel Content Container - Three Panel Desktop */}
      <div 
        style={{
          display: 'flex',
          flex: 1,
          background: 'var(--bg-primary)',
          overflow: 'hidden',
        }}
      >
        {/* LEFT SIDEBAR (Width 64px, collapsed, icons only) */}
        <LeftNav 
          activeTab={activeTab} 
          onTabChange={(tabId) => {
            setActiveTab(tabId);
            if (tabId === 'chat') {
              setIsGlobalChatOpen(true);
              // Auto-reset activeTab to dashboard so dashboard remains active when chat overlay closes
              setTimeout(() => setActiveTab('dashboard'), 200);
            }
          }} 
        />

        {/* CENTER PANEL (Primary Workspace) */}
        <div 
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Category Tabs Bar at top of Center Panel */}
          <CategoryTabs activeCategory={activeCategory} onSelectCategory={setActiveCategory} />

          {/* Sub-panels layout container */}
          <div 
            style={{
              display: 'flex',
              flex: 1,
              overflow: 'hidden',
            }}
          >
            {/* Left Column - Market Scanner (Width 340px) */}
            <div 
              style={{
                width: '340px',
                minWidth: '340px',
                height: '100%',
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <MarketScanner
                markets={enrichedMarkets}
                selectedMarket={selectedMarket}
                onSelectMarket={handleSelectMarket}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
                lastUpdated={lastUpdated}
                isRefreshing={isRefreshing}
                onRefresh={handleManualRefresh}
                pricesError={!!pricesError}
                hideHeaderAndTabs={true}
              />
            </div>

            {/* Right Column - Prediction details (flex-1) */}
            <div 
              style={{
                flex: 1,
                height: '100%',
                overflowY: 'auto',
                background: 'var(--bg-primary)',
              }}
              className="no-scrollbar"
            >
              {activeTab === 'settings' ? (
                <div style={{
                  padding: '40px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  height: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '32px', color: 'var(--accent)', animation: 'pulse 2s infinite' }}>⊙</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.15em', color: 'var(--text-primary)' }}>
                      SYSTEM SETTINGS & TELEMETRY
                    </div>
                    <div style={{ fontSize: '12px', maxWidth: '340px', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                      All systems are active. API integrations, Polymarket SWR sync, and Groq LLM pipelines are fully operational.
                    </div>
                  </div>
                  <div style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px 24px',
                    background: 'var(--bg-secondary)',
                    fontSize: '11px',
                    textAlign: 'left',
                    width: '100%',
                    maxWidth: '400px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>SWR Sync Rate:</span>
                      <span style={{ color: 'var(--green)' }}>10s (Prices) / 24h (Meta)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>LLM Agent Model:</span>
                      <span style={{ color: 'var(--accent)' }}>llama-3.1-70b-versatile</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>CLOB WebSocket:</span>
                      <span style={{ color: 'var(--green)' }}>Active (Gamma-API)</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(0, 209, 255, 0.1)',
                      border: '1px solid var(--accent-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--accent)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Return to Terminal
                  </button>
                </div>
              ) : (
                <PredictionCard
                  market={selectedMarket}
                  livePrices={livePrices}
                  pricesError={!!pricesError}
                  onAnalysisLoaded={handleAnalysisLoaded}
                  triggerReanalyzeCount={reanalyzeCount}
                  onAskAI={() => setChatFocusTrigger((prev) => prev + 1)}
                  marketSentiment={marketSentiment}
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL (AI Chat - Width 360px internally inside ChatPanel) */}
        <ChatPanel 
          market={selectedMarket} 
          analysis={activeAnalysis} 
          markets={enrichedMarkets} 
          chatFocusTrigger={chatFocusTrigger}
          marketSentiment={marketSentiment}
        />
      </div>

      {/* Floating Action Button (FAB) for Global Chat Mode */}
      <div className="fixed bottom-6 right-[390px] z-40">
        <button
          onClick={() => setIsGlobalChatOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#00d4ff] bg-[#0d1219]/95 text-[#00d4ff] hover:bg-[#00d4ff]/25 hover:shadow-[0_0_15px_rgba(0,212,255,0.4)] active:scale-[0.97] transition-all cursor-pointer shadow-[0_0_10px_rgba(0,212,255,0.2)] font-mono text-xs font-bold shrink-0"
          title="Open Global Analyst Chat"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4ff] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d4ff]"></span>
          </span>
          ALPHA·CAST CHAT
        </button>
      </div>

      {/* Global Intel Chat Overlay Terminal */}
      <GlobalChat isOpen={isGlobalChatOpen} onClose={() => setIsGlobalChatOpen(false)} />
    </main>
  );
}
