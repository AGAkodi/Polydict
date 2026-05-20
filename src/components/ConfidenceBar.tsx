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

  const getEdgeColor = (val: number) => {
    if (val > 5) return 'text-emerald-400';
    if (val < -5) return 'text-rose-400';
    return 'text-amber-400';
  };

  const getEdgeBg = (val: number) => {
    if (val > 5) return 'bg-emerald-500/10 border-emerald-500/20';
    if (val < -5) return 'bg-rose-500/10 border-rose-500/20';
    return 'bg-amber-500/10 border-amber-500/20';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs text-slate-400 uppercase tracking-wider font-semibold">
        <span>Probability Comparison</span>
        <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${getEdgeBg(edgePct)} ${getEdgeColor(edgePct)}`}>
          {edgePct >= 0 ? `+${edgePct}%` : `${edgePct}%`} EDGE
        </span>
      </div>

      <div className="space-y-3">
        {/* Agent Confidence Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-blue-400">PolyDict Forecast</span>
            <span className="text-blue-400">{confPct}%</span>
          </div>
          <div className="h-2 w-full bg-[#1e293b] rounded-full overflow-hidden border border-blue-500/10">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${confPct}%` }}
            />
          </div>
        </div>

        {/* Polymarket Odds Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-400">Polymarket Odds (YES)</span>
            <span className="text-slate-300 font-semibold">{oddsPct}%</span>
          </div>
          <div className="h-2 w-full bg-[#1e293b] rounded-full overflow-hidden border border-slate-700/30">
            <div 
              className="h-full bg-slate-500 rounded-full transition-all duration-1000"
              style={{ width: `${oddsPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
