import React from 'react';

interface Signal {
  direction: 'bull' | 'bear' | 'neutral';
  source?: 'news' | 'social' | 'market';
  text: string;
}

interface SignalRowProps {
  signal: Signal;
}

export default function SignalRow({ signal }: SignalRowProps) {
  const getDirectionDetails = (dir: string) => {
    switch (dir.toLowerCase()) {
      case 'bull':
        return {
          icon: '▲',
          color: 'text-[#00e676]',
          label: 'BULL'
        };
      case 'bear':
        return {
          icon: '▼',
          color: 'text-[#ff5252]',
          label: 'BEAR'
        };
      case 'neutral':
      default:
        return {
          icon: '◆',
          color: 'text-[#ffab40]',
          label: 'NEUT'
        };
    }
  };

  const getSourceDetails = (src?: string) => {
    switch (src?.toLowerCase()) {
      case 'news':
        return {
          border: 'border-[#00d4ff]/30',
          bg: 'bg-[#00d4ff]/5',
          label: 'NEWS',
          textColor: 'text-[#00d4ff]'
        };
      case 'social':
        return {
          border: 'border-[#ffab40]/30',
          bg: 'bg-[#ffab40]/5',
          label: 'SOCIAL',
          textColor: 'text-[#ffab40]'
        };
      case 'market':
        return {
          border: 'border-indigo-500/30',
          bg: 'bg-indigo-500/5',
          label: 'MARKET',
          textColor: 'text-indigo-400'
        };
      default:
        return {
          border: 'border-[#1e2a38]',
          bg: 'bg-[#111820]',
          label: 'SIGNAL',
          textColor: 'text-slate-400'
        };
    }
  };

  const dir = getDirectionDetails(signal.direction);
  const src = getSourceDetails(signal.source);

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-md border text-xs font-mono transition-all ${src.border} ${src.bg}`}>
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <span className={`font-bold shrink-0 text-[10px] tracking-wider px-1.5 py-0.5 rounded border border-current/20 bg-current/5 ${src.textColor}`}>
          {src.label}
        </span>
        <span className="text-slate-200 select-text leading-relaxed font-sans text-xs">
          {signal.text}
        </span>
      </div>
      <div className={`flex items-center font-bold shrink-0 text-[10px] tracking-wider ${dir.color}`}>
        {dir.icon} {dir.label}
      </div>
    </div>
  );
}

