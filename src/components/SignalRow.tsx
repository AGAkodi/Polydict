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
  const getDotColor = (dir: string) => {
    switch (dir.toLowerCase()) {
      case 'bull':
        return 'var(--green)';
      case 'bear':
        return 'var(--red)';
      case 'neutral':
      default:
        return 'var(--amber)';
    }
  };

  const getSourceLabel = (src?: string) => {
    switch (src?.toLowerCase()) {
      case 'news':
        return 'NEWS';
      case 'social':
        return 'SOCIAL';
      case 'market':
        return 'MARKET';
      default:
        return 'SIGNAL';
    }
  };

  const dotColor = getDotColor(signal.direction);
  const sourceLabel = getSourceLabel(signal.source);

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 0',
      }}
    >
      {/* 4px circle colored dot */}
      <span 
        style={{
          width: '6px',
          height: '6px',
          minWidth: '6px',
          borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 6px ${dotColor}`,
          display: 'inline-block',
          flexShrink: 0,
        }} 
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        {/* Source label */}
        <span 
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            fontWeight: '600',
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}
        >
          [{sourceLabel}]
        </span>

        {/* Text in Inter 12px */}
        <span 
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: '1.4',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
          className="truncate"
        >
          {signal.text}
        </span>
      </div>
    </div>
  );
}
