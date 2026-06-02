import React from 'react';
import { MergedMarket } from '../utils/polymarket';
import { formatVolume, getCountdown } from '../utils/helpers';

interface MarketItemProps {
  market: MergedMarket;
  isSelected: boolean;
  onSelect: () => void;
}

export default function MarketItem({ market, isSelected, onSelect }: MarketItemProps) {
  const yesPricePct = Math.round(market.yesPrice * 100);
  const countdown = getCountdown(market.endDateIso || market.endDate);

  const getCountdownColor = (severity: string) => {
    switch (severity) {
      case 'red':
        return 'var(--red)';
      case 'amber':
        return 'var(--amber)';
      case 'closed':
        return 'var(--text-muted)';
      case 'gray':
      default:
        return 'var(--text-secondary)';
    }
  };

  return (
    <div
      onClick={onSelect}
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
      {/* Market question text */}
      <h4 
        style={{
          fontSize: '12px',
          fontWeight: '500',
          color: 'var(--text-primary)',
          lineHeight: '1.4',
          marginBottom: '6px',
          fontFamily: 'var(--font-sans)',
          margin: '0 0 6px 0',
        }}
        className="line-clamp-2"
      >
        {market.question}
      </h4>

      {/* Odds pill and Metadata Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
        {/* Odds pill — neutral, no color bias */}
        <div 
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: '600',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {yesPricePct}% YES
          {market.priceChange24h !== 0 && market.priceChange24h !== undefined && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: market.priceChange24h > 0 ? 'var(--green)' : 'var(--red)',
              marginLeft: '6px',
            }}>
              {market.priceChange24h > 0 ? '↑' : '↓'}
              {Math.abs(market.priceChange24h * 100).toFixed(1)}pp
            </span>
          )}
        </div>

        {/* Volume & Countdown metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Volume tag */}
          <div 
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
            }}
          >
            VOL: <span style={{ color: 'var(--text-secondary)' }}>{formatVolume(market.volume)}</span>
          </div>

          {/* Time Remaining tag */}
          <div 
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
            }}
          >
            TIME:{' '}
            <span style={{ color: getCountdownColor(countdown.severity), fontWeight: 600 }}>
              {countdown.label.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
