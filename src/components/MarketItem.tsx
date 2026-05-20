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

  // YES price pill threshold styling: green >=60%, amber 35-60%, red <35%
  let oddsPillClass = '';
  if (yesPricePct >= 60) {
    oddsPillClass = 'border-[#00e676]/20 bg-[#00e676]/10 text-[#00e676]';
  } else if (yesPricePct >= 35) {
    oddsPillClass = 'border-[#ffab40]/20 bg-[#ffab40]/10 text-[#ffab40]';
  } else {
    oddsPillClass = 'border-[#ff5252]/20 bg-[#ff5252]/10 text-[#ff5252]';
  }

  const getCountdownColor = (severity: string) => {
    switch (severity) {
      case 'red':
        return 'text-[#ff5252] font-semibold';
      case 'amber':
        return 'text-[#ffab40] font-medium';
      case 'closed':
        return 'text-slate-600';
      case 'gray':
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative p-3 border-b border-[#1e2a38] transition-all duration-150 cursor-pointer select-none ${
        isSelected
          ? 'bg-[#111820]/80 border-l-2 border-l-[#00d4ff]'
          : 'hover:bg-[#111820]/40 border-l-2 border-l-transparent'
      }`}
    >
      <div className="space-y-2">
        {/* Question Title - weight 500 */}
        <h4 className={`text-xs font-medium font-sans line-clamp-2 leading-relaxed transition-colors ${
          isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'
        }`}>
          {market.question}
        </h4>

        {/* Real-Time Price Pill and Metadata Row */}
        <div className="flex items-center justify-between mt-1">
          {/* YES Odds Pill Badge - weight 600 */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[10px] font-semibold font-mono tracking-wider ${oddsPillClass}`}>
            <span>YES</span>
            <span className="font-semibold text-[11px]">{yesPricePct}%</span>
          </div>

          {/* Volume and Countdown metadata */}
          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
            <div>
              <span className="font-medium">VOL:</span>{' '}
              <span className="text-slate-300 font-semibold">{formatVolume(market.volume)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">TIME:</span>{' '}
              <span className={`font-semibold ${getCountdownColor(countdown.severity)}`}>
                {countdown.label.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
