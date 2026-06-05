import React from 'react';
import { MergedMarket } from '../utils/polymarket';
import { formatVolume } from '../utils/helpers';

interface WatchlistProps {
  markets: MergedMarket[];
  watchlist: string[];
  selectedMarket: MergedMarket | null;
  onSelectMarket: (market: MergedMarket) => void;
  onToggleWatchlist: (id: string) => void;
}

export default function Watchlist({
  markets,
  watchlist,
  selectedMarket,
  onSelectMarket,
  onToggleWatchlist,
}: WatchlistProps) {
  const watchedMarkets = React.useMemo(() => {
    return markets.filter((m) => watchlist.includes(m.id));
  }, [markets, watchlist]);

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{
        background: 'var(--bg-secondary)',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'between',
          background: 'var(--bg-secondary)',
        }}
        className="shrink-0"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', color: 'var(--accent)' }}>★</span>
          <h1 style={{
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '0.12em',
            fontFamily: 'var(--font-mono)',
            color: '#FFF',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            WATCHLIST
          </h1>
          <span
            style={{
              background: 'var(--accent-glow)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
              borderRadius: '10px',
              padding: '1px 6px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 'bold',
            }}
          >
            {watchedMarkets.length}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ background: 'transparent' }}>
        {watchedMarkets.length > 0 ? (
          <div>
            {watchedMarkets.map((market) => {
              const isSelected = selectedMarket?.id === market.id;
              const yesPricePct = Math.round(market.yesPrice * 100);

              return (
                <div
                  key={market.id}
                  onClick={() => onSelectMarket(market)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-left 0.15s',
                    background: isSelected ? 'var(--accent-glow)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    {market.eventImage && (
                      <img
                        src={market.eventImage}
                        alt=""
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          objectFit: 'cover',
                          flexShrink: 0,
                          border: '1px solid var(--border)',
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: 'var(--text-primary)',
                          lineHeight: '1.4',
                          marginBottom: '4px',
                          fontFamily: 'var(--font-sans)',
                          margin: '0 0 4px 0',
                        }}
                        className="line-clamp-2"
                      >
                        {market.question}
                      </h4>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(market.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '2px 4px',
                        outline: 'none',
                        fontFamily: 'var(--font-sans)',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {yesPricePct}% YES
                      {market.priceChange24h !== 0 && market.priceChange24h !== undefined && (
                        <span style={{
                          color: market.priceChange24h > 0 ? 'var(--green)' : 'var(--red)',
                          marginLeft: '4px',
                        }}>
                          {market.priceChange24h > 0 ? '↑' : '↓'}
                          {Math.abs(market.priceChange24h * 100).toFixed(1)}pp
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      VOL: <span style={{ color: 'var(--text-secondary)' }}>{formatVolume(market.volume)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              fontWeight: '600',
              letterSpacing: '0.12em',
              lineHeight: '1.6',
            }}
          >
            WATCHLIST IS EMPTY<br />
            <span style={{ fontSize: '9px', fontWeight: 'normal', color: 'var(--text-secondary)', textTransform: 'none' }}>
              Click the ◈ button on any market in the scanner list to add it.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
