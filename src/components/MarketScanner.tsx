import React, { useState, useMemo } from 'react';
import { MergedMarket } from '../utils/polymarket';
import CategoryTabs from './CategoryTabs';
import MarketItem from './MarketItem';

interface MarketScannerProps {
  markets: MergedMarket[];
  selectedMarket: MergedMarket | null;
  onSelectMarket: (market: MergedMarket) => void;
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  lastUpdated: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const ITEMS_PER_PAGE = 15;

export default function MarketScanner({
  markets,
  selectedMarket,
  onSelectMarket,
  activeCategory,
  onSelectCategory,
  lastUpdated,
  isRefreshing,
  onRefresh,
}: MarketScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Reset pagination when category or search changes
  React.useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeCategory, searchQuery]);

  // Find the trending featured market of the day (highest volume market in currently loaded category set)
  const featuredMarket = useMemo(() => {
    if (!markets || markets.length === 0) return null;
    return [...markets].sort((a, b) => (b.volume || 0) - (a.volume || 0))[0];
  }, [markets]);

  // Filter visible markets based on keyword search
  const filteredMarkets = useMemo(() => {
    if (!searchQuery.trim()) return markets;
    const query = searchQuery.toLowerCase().trim();
    return markets.filter(
      (m) =>
          m.question.toLowerCase().includes(query) ||
          (m.description && m.description.toLowerCase().includes(query))
    );
  }, [markets, searchQuery]);

  // Filter out the featured market from the scrolling list below when search is empty to avoid duplicate display
  const scrollableMarkets = useMemo(() => {
    if (!searchQuery.trim() && featuredMarket) {
      return filteredMarkets.filter((m) => m.id !== featuredMarket.id);
    }
    return filteredMarkets;
  }, [filteredMarkets, searchQuery, featuredMarket]);

  // Paginated subset of markets
  const visibleMarkets = useMemo(() => {
    return scrollableMarkets.slice(0, visibleCount);
  }, [scrollableMarkets, visibleCount]);

  const hasMore = scrollableMarkets.length > visibleCount;

  const loadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0d1219] border-r border-[#1e2a38]">
      {/* Top Header Panel */}
      <div className="p-4 border-b border-[#1e2a38] flex flex-col gap-2 shrink-0 bg-[#0d1219]">
        <div className="flex items-center justify-between">
          {/* Logo with Pulsing Green Network Dot */}
          <div className="flex items-center">
            <span className="relative flex h-2 w-2 mr-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e676] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00e676]"></span>
            </span>
            <h1 className="text-sm font-bold tracking-wider font-mono text-white select-none">
              PolyDict
            </h1>

            <span className="ml-2 text-[9px] font-bold font-mono bg-[#00d4ff]/10 text-[#00d4ff] px-1.5 py-0.5 rounded border border-[#00d4ff]/20">
              DESK
            </span>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-sm border border-[#1e2a38] bg-[#080c10] text-slate-400 hover:text-[#00d4ff] hover:bg-[#1e2a38] hover:border-[#00d4ff]/30 disabled:opacity-40 transition-all cursor-pointer"
            title="Refresh Feed"
          >
            <svg
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M21 3v5h-5"
              />
            </svg>
          </button>
        </div>

        {/* Caching Status Bar */}
        <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00e676] animate-pulse"></span>
            LIVE-ONLY TELEMETRY
          </span>
          <span>SYNCED: {lastUpdated}</span>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <CategoryTabs activeCategory={activeCategory} onSelectCategory={onSelectCategory} />

      {/* Search Input Box */}
      <div className="p-3 border-b border-[#1e2a38] bg-[#0d1219]/50 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prediction contracts..."
            className="w-full bg-[#080c10] border border-[#1e2a38] focus:border-[#00d4ff]/60 focus:ring-1 focus:ring-[#00d4ff]/20 text-slate-100 placeholder-slate-600 outline-none text-xs font-mono px-3 py-2 rounded-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-semibold px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Markets List Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[#080c10]/20">
        {!searchQuery.trim() && featuredMarket && (
          <div className="p-3 border-b border-[#1e2a38] bg-[#1a130b]/20">
            <div className="text-[10px] font-semibold text-[#ffab40] flex items-center gap-1.5 mb-2 font-mono select-none uppercase tracking-wider">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffab40] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffab40]"></span>
              </span>
              🔥 FEATURED CONTRACT
            </div>
            
            <div
              onClick={() => onSelectMarket(featuredMarket)}
              className={`group p-3.5 rounded border transition-all duration-200 cursor-pointer ${
                selectedMarket?.id === featuredMarket.id
                  ? 'bg-[#111820]/90 border-[#00d4ff] shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                  : 'bg-[#0f172a]/70 border-[#2e3b4e] hover:border-[#00d4ff]/60 hover:bg-[#1a2333]/50'
              }`}
            >
              {/* Question Title - weight 500 */}
              <h3 className={`text-xs font-medium leading-relaxed line-clamp-3 transition-colors ${
                selectedMarket?.id === featuredMarket.id ? 'text-white' : 'text-slate-200 group-hover:text-white'
              }`}>
                {featuredMarket.question}
              </h3>
              
              <div className="flex items-center justify-between mt-3">
                {/* Trending Badge - weight 600 */}
                <div className="px-2 py-0.5 rounded-sm bg-[#ffab40]/10 border border-[#ffab40]/20 text-[9px] font-mono text-[#ffab40] font-semibold uppercase tracking-widest">
                  Trending
                </div>
                
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <div className="text-slate-500">
                    <span className="font-medium">VOL:</span>{' '}
                    <span className="text-slate-300 font-semibold">
                      {new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        compactDisplay: 'short',
                        style: 'currency',
                        currency: 'USD',
                      }).format(featuredMarket.volume || 0)}
                    </span>
                  </div>
                  
                  {/* Odds Badge - weight 600 */}
                  <div className="px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-semibold text-[10px]">
                    YES {Math.round(featuredMarket.yesPrice * 100)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {visibleMarkets.length > 0 ? (
          <div>
            {visibleMarkets.map((market) => (
              <MarketItem
                key={market.id}
                market={market}
                isSelected={selectedMarket?.id === market.id}
                onSelect={() => onSelectMarket(market)}
              />
            ))}

            {/* Load More Trigger */}
            {hasMore && (
              <div className="p-4 flex justify-center border-t border-[#1e2a38] bg-[#0d1219]/10">
                <button
                  onClick={loadMore}
                  className="px-4 py-2 rounded-sm border border-[#1e2a38] bg-[#111820] text-xs font-mono font-semibold text-slate-400 hover:text-white hover:bg-[#1e2a38] hover:border-[#00d4ff]/40 transition-all cursor-pointer"
                >
                  Load More ({filteredMarkets.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-xs font-mono text-slate-600 font-semibold tracking-wider">
            NO ACTIVE PREDICTION CONTRACTS FOUND
          </div>
        )}
      </div>
    </div>
  );
}
