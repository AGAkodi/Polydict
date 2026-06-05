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
  pricesError?: boolean;
  hideHeaderAndTabs?: boolean;
  watchlist: string[];
  onToggleWatchlist: (id: string) => void;
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
  pricesError,
  hideHeaderAndTabs = false,
  watchlist,
  onToggleWatchlist,
}: MarketScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Reset pagination when category or search changes
  React.useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeCategory, searchQuery]);

  // Safety net filtering on markets
  const safetyFilteredMarkets = useMemo(() => {
    return markets || [];
  }, [markets]);

  // Find the trending featured market of the day (highest volume market)
  const featuredMarket = useMemo(() => {
    if (!safetyFilteredMarkets || safetyFilteredMarkets.length === 0) return null;
    return [...safetyFilteredMarkets].sort((a, b) => (b.volume || 0) - (a.volume || 0))[0];
  }, [safetyFilteredMarkets]);

  // Filter visible markets based on keyword search
  const filteredMarkets = useMemo(() => {
    if (!searchQuery.trim()) return safetyFilteredMarkets;
    const query = searchQuery.toLowerCase().trim();
    return safetyFilteredMarkets.filter(
      (m) =>
          m.question.toLowerCase().includes(query) ||
          (m.description && m.description.toLowerCase().includes(query))
    );
  }, [safetyFilteredMarkets, searchQuery]);

  // Filter out the featured market from the scrolling list below when search is empty
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
    <div 
      className="flex flex-col h-full w-full"
      style={{
        background: 'var(--bg-secondary)',
        height: '100%',
      }}
    >
      {/* Top Header Panel - only rendered if hideHeaderAndTabs is false */}
      {!hideHeaderAndTabs && (
        <div 
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'var(--bg-secondary)',
          }}
          className="shrink-0"
        >
          <div className="flex items-center justify-between">
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

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-sm border border-[#1e2a38] bg-[#080c10] text-slate-400 hover:text-[#00d4ff] hover:bg-[#1e2a38] hover:border-[#00d4ff]/30 disabled:opacity-40 transition-all cursor-pointer"
            >
              <svg className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M21 3v5h-5" />
              </svg>
            </button>
          </div>

          <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
            {pricesError ? (
              <span className="flex items-center gap-1 text-[#ff5252] font-semibold animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff5252]"></span>
                CLOB TELEMETRY OFFLINE
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00e676] animate-pulse"></span>
                LIVE-ONLY TELEMETRY
              </span>
            )}
            <span>SYNCED: {lastUpdated}</span>
          </div>
        </div>
      )}

      {/* Category Pills Navigation - only rendered if hideHeaderAndTabs is false */}
      {!hideHeaderAndTabs && (
        <CategoryTabs activeCategory={activeCategory} onSelectCategory={onSelectCategory} />
      )}

      {/* Search Input Box */}
      <div 
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.01)',
        }}
        className="shrink-0"
      >
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prediction contracts..."
            style={{
              width: '100%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-sans)',
              padding: '8px 12px',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-border)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
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
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ background: 'transparent' }}>
        {/* Featured Contract Block */}
        {!searchQuery.trim() && featuredMarket && (
          <div 
            style={{
              padding: '12px',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(255, 183, 77, 0.02)',
            }}
          >
            <div 
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: '600',
                letterSpacing: '0.14em',
                color: 'var(--amber)',
                textTransform: 'uppercase',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                userSelect: 'none',
              }}
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffb74d] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffb74d]"></span>
              </span>
              ◈ FEATURED CONTRACT
            </div>
            
            <div
              onClick={() => onSelectMarket(featuredMarket)}
              style={{
                background: selectedMarket?.id === featuredMarket.id ? 'var(--accent-glow)' : 'var(--bg-card)',
                border: selectedMarket?.id === featuredMarket.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (selectedMarket?.id !== featuredMarket.id) {
                  e.currentTarget.style.borderColor = 'var(--accent-border)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMarket?.id !== featuredMarket.id) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-card)';
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <h3 
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    lineHeight: '1.4',
                    fontFamily: 'var(--font-sans)',
                    margin: 0,
                    flex: 1,
                  }}
                  className="line-clamp-2"
                >
                  {featuredMarket.question}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatchlist(featuredMarket.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: watchlist.includes(featuredMarket.id) ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '2px 4px',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    transition: 'color 0.15s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = watchlist.includes(featuredMarket.id) ? 'var(--accent)' : 'var(--text-muted)'}
                >
                  {watchlist.includes(featuredMarket.id) ? '◈' : '◇'}
                </button>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                <div 
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    fontWeight: '600',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--amber-glow)',
                    border: '1px solid rgba(255, 183, 77, 0.2)',
                    color: 'var(--amber)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Trending
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>
                    VOL:{' '}
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        compactDisplay: 'short',
                        style: 'currency',
                        currency: 'USD',
                      }).format(featuredMarket.volume || 0)}
                    </span>
                  </div>
                  
                  <div 
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: '600',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0, 230, 118, 0.08)',
                      border: '1px solid rgba(0, 230, 118, 0.2)',
                      color: 'var(--green)',
                    }}
                  >
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
                isWatched={watchlist.includes(market.id)}
                onToggleWatchlist={onToggleWatchlist}
              />
            ))}

            {/* Load More Trigger */}
            {hasMore && (
              <div 
                style={{
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  background: 'transparent',
                }}
              >
                <button
                  onClick={loadMore}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-border)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.background = 'var(--accent-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Load More ({filteredMarkets.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div 
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              fontWeight: '600',
              letterSpacing: '0.12em',
            }}
          >
            NO ACTIVE PREDICTION CONTRACTS FOUND
          </div>
        )}
      </div>
    </div>
  );
}
