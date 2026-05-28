'use strict';

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import MarketScanner from '../components/MarketScanner';
import PredictionCard from '../components/PredictionCard';
import ChatPanel from '../components/ChatPanel';
import GlobalChat from '../components/GlobalChat';
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
  const [reanalyzeCount, setReanalyzeCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>('--:--:--');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);

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
  const { data: livePrices, error: pricesError, mutate: mutatePrices } = useSWR<Record<string, { yes: number; no: number; vol: number }>>(
    '/api/prices',
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  // Merge live prices into market list in-memory — enrichedMarkets is the single source of truth
  const enrichedMarkets = useMemo(() => {
    if (!markets) return [];
    if (!livePrices) return markets;
    return markets.map((m: MergedMarket) => ({
      ...m,
      yesPrice: livePrices[m.conditionId]?.yes ?? m.yesPrice,
      noPrice: livePrices[m.conditionId]?.no ?? m.noPrice,
      volume: livePrices[m.conditionId]?.vol ?? m.volume,
    }));
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
    <main className="flex-1 flex flex-col h-screen w-screen overflow-hidden bg-[#080c10] bg-grid-pattern relative">
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

      {/* Main Panel Content Container */}
      <div className="flex-1 flex flex-row w-full overflow-hidden">
        {/* Panel 1 - Market Scanner (Left Sidebar) */}
        <section className="w-[340px] shrink-0 h-full">
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
          />
        </section>

        {/* Panel 2 - Prediction Card (Center Panel) */}
        <section className="flex-1 h-full min-w-[400px]">
          <PredictionCard
            market={selectedMarket}
            livePrices={livePrices}
            pricesError={!!pricesError}
            onAnalysisLoaded={handleAnalysisLoaded}
            triggerReanalyzeCount={reanalyzeCount}
          />
        </section>

        {/* Panel 3 - Chat terminal (Right Sidebar) */}
        <section className="w-[370px] shrink-0 h-full">
          <ChatPanel market={selectedMarket} analysis={activeAnalysis} markets={enrichedMarkets} />
        </section>
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
