import React from 'react';

interface ConfidenceBarProps {
  confidence: number; // 0.0 - 1.0
  marketOdds: number; // 0.0 - 1.0
  edge: number; // -1.0 - 1.0
}

export default function ConfidenceBar({ confidence, marketOdds, edge }: ConfidenceBarProps) {
  const confPct = Math.round(confidence * 100);
  const oddsPct = Math.round(marketOdds * 100);
  const edgePct = Math.round(edge * 100);

  // Math-based verdict check to guarantee safety
  let verdict: 'YES' | 'NO' | 'SKIP' = 'SKIP';
  if (edge > 0.05) {
    verdict = 'YES';
  } else if (edge < -0.05) {
    verdict = 'NO';
  }

  const getVerdictColor = (v: string) => {
    if (v === 'YES') return 'var(--green)';
    if (v === 'NO') return 'var(--red)';
    return 'var(--amber)';
  };

  const getEdgeBg = (val: number) => {
    if (val > 5) return 'rgba(0, 230, 118, 0.08)';
    if (val < -5) return 'rgba(255, 82, 82, 0.08)';
    return 'rgba(255, 183, 77, 0.08)';
  };

  const getEdgeBorder = (val: number) => {
    if (val > 5) return 'rgba(0, 230, 118, 0.2)';
    if (val < -5) return 'rgba(255, 82, 82, 0.2)';
    return 'rgba(255, 183, 77, 0.2)';
  };

  const getEdgeTextColor = (val: number) => {
    if (val > 5) return 'var(--green)';
    if (val < -5) return 'var(--red)';
    return 'var(--amber)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Section Header */}
        <span 
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            fontWeight: '600',
            letterSpacing: '0.14em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}
        >
          Probability Comparison
        </span>
        
        {/* Edge Badge */}
        <span 
          style={{
            padding: '2px 8px',
            borderRadius: '4px',
            border: `1px solid ${getEdgeBorder(edgePct)}`,
            background: getEdgeBg(edgePct),
            color: getEdgeTextColor(edgePct),
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
        >
          {edgePct >= 0 ? `+${edgePct}%` : `${edgePct}%`} EDGE
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Agent Confidence Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>PolyDict Forecast</span>
            <span style={{ color: getVerdictColor(verdict), fontWeight: 600 }}>{confPct}%</span>
          </div>
          <div 
            style={{
              height: '3px',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div 
              style={{
                height: '100%',
                background: getVerdictColor(verdict),
                width: `${confPct}%`,
                borderRadius: '2px',
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: verdict === 'YES' 
                  ? '0 0 8px rgba(0, 230, 118, 0.4)' 
                  : verdict === 'NO' 
                    ? '0 0 8px rgba(255, 82, 82, 0.4)' 
                    : '0 0 8px rgba(255, 183, 77, 0.4)',
              }}
            />
          </div>
        </div>

        {/* Polymarket Odds Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Polymarket Odds (YES)</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{oddsPct}%</span>
          </div>
          <div 
            style={{
              height: '3px',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div 
              style={{
                height: '100%',
                background: 'var(--accent)',
                width: `${oddsPct}%`,
                borderRadius: '2px',
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 8px rgba(0, 209, 255, 0.4)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
