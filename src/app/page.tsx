'use strict';

'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import MarketScanner from '../components/MarketScanner';
import PredictionCard from '../components/PredictionCard';
import ChatPanel from '../components/ChatPanel';
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

  // Setup SWR with 24h refresh interval (86400000 ms)
  const { data: markets = [], error, mutate } = useSWR<MergedMarket[]>(
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

  // Run cleanup once on page load (mount)
  useEffect(() => {
    clearStaleLocalStorageAnalyses();
  }, []);

  // Auto-select the featured prediction of the day (highest volume/trending) when the list loads
  useEffect(() => {
    if (markets && markets.length > 0) {
      // Find the trending market (highest volume) to serve as our Featured Prediction of the Day
      const sortedByVolume = [...markets].sort((a, b) => (b.volume || 0) - (a.volume || 0));
      const trendingMarket = sortedByVolume[0] || markets[0];
      
      const exists = markets.find((m) => m.id === selectedMarket?.id);
      if (!selectedMarket || !exists) {
        setSelectedMarket(trendingMarket);
      } else {
        // Keep the selected market updated with the latest live price data
        const updated = markets.find((m) => m.id === selectedMarket.id);
        if (updated) {
          setSelectedMarket(updated);
        }
      }
    } else {
      setSelectedMarket(null);
    }
  }, [markets]);

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
    <main className="flex-1 flex flex-row h-screen w-screen overflow-hidden bg-[#080c10]">
      {/* Panel 1 - Market Scanner (Left Sidebar) */}
      <section className="w-[340px] shrink-0 h-full">
        <MarketScanner
          markets={markets}
          selectedMarket={selectedMarket}
          onSelectMarket={handleSelectMarket}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          onRefresh={handleManualRefresh}
        />
      </section>

      {/* Panel 2 - Prediction Card (Center Panel) */}
      <section className="flex-1 h-full min-w-[400px]">
        <PredictionCard
          market={selectedMarket}
          onAnalysisLoaded={handleAnalysisLoaded}
          triggerReanalyzeCount={reanalyzeCount}
        />
      </section>

      {/* Panel 3 - Chat terminal (Right Sidebar) */}
      <section className="w-[370px] shrink-0 h-full">
        <ChatPanel market={selectedMarket} analysis={activeAnalysis} />
      </section>
    </main>
  );
}
