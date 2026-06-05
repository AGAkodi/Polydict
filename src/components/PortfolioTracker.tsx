import React, { useState, useMemo } from 'react';
import { MergedMarket } from '../utils/polymarket';

interface Transaction {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcome: 'YES' | 'NO';
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number; // 0 to 1
  timestamp: number;
}

interface Position {
  marketId: string;
  marketQuestion: string;
  outcome: 'YES' | 'NO';
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

interface PortfolioTrackerProps {
  markets: MergedMarket[];
  selectedMarket: MergedMarket | null;
  onSelectMarket: (market: MergedMarket) => void;
}

const STORAGE_KEY = 'polydict_portfolio_txs';

export default function PortfolioTracker({
  markets,
  selectedMarket,
  onSelectMarket,
}: PortfolioTrackerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse portfolio transactions', e);
        }
      }
    }
    return [];
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [txMarketId, setTxMarketId] = useState<string>('');
  const [txOutcome, setTxOutcome] = useState<'YES' | 'NO'>('YES');
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [txQuantity, setTxQuantity] = useState<string>('100');
  const [txPrice, setTxPrice] = useState<string>('0.50');

  // Sync default form values when selectedMarket changes
  React.useEffect(() => {
    if (selectedMarket) {
      setTxMarketId(selectedMarket.id);
      const currentYesPrice = selectedMarket.yesPrice ?? 0.5;
      setTxPrice(txOutcome === 'YES' ? currentYesPrice.toFixed(2) : (1 - currentYesPrice).toFixed(2));
    }
  }, [selectedMarket, txOutcome]);

  const saveTransactions = (newTxs: Transaction[]) => {
    setTransactions(newTxs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTxs));
  };

  const handleOutcomeChange = (outcome: 'YES' | 'NO') => {
    setTxOutcome(outcome);
    if (selectedMarket) {
      const currentYesPrice = selectedMarket.yesPrice ?? 0.5;
      setTxPrice(outcome === 'YES' ? currentYesPrice.toFixed(2) : (1 - currentYesPrice).toFixed(2));
    }
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const market = markets.find((m) => m.id === txMarketId);
    if (!market) return;

    const qty = parseFloat(txQuantity);
    const prc = parseFloat(txPrice);

    if (isNaN(qty) || qty <= 0 || isNaN(prc) || prc <= 0 || prc >= 1) {
      alert('Please enter valid quantity (>0) and price (between 0.01 and 0.99)');
      return;
    }

    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 9),
      marketId: market.id,
      marketQuestion: market.question,
      outcome: txOutcome,
      type: txType,
      quantity: qty,
      price: prc,
      timestamp: Date.now(),
    };

    saveTransactions([newTx, ...transactions]);
    setIsFormOpen(false);
  };

  const handleClosePosition = (position: Position) => {
    const market = markets.find((m) => m.id === position.marketId);
    const currentPrice = market
      ? position.outcome === 'YES'
        ? (market.yesPrice ?? 0.5)
        : (market.noPrice ?? 1 - (market.yesPrice ?? 0.5))
      : position.outcome === 'YES'
      ? 0.5
      : 0.5;

    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 9),
      marketId: position.marketId,
      marketQuestion: position.marketQuestion,
      outcome: position.outcome,
      type: 'SELL',
      quantity: position.quantity,
      price: currentPrice,
      timestamp: Date.now(),
    };

    saveTransactions([newTx, ...transactions]);
  };

  const handleClearPortfolio = () => {
    if (window.confirm('Are you sure you want to clear all transactions and reset your portfolio?')) {
      saveTransactions([]);
    }
  };

  // Compute Active Positions and Realized P&L
  const { positions, totalRealizedPnL } = useMemo(() => {
    const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
    const marketPositions: Record<string, { YES?: { qty: number; cost: number; realized: number }; NO?: { qty: number; cost: number; realized: number } }> = {};

    sortedTxs.forEach((tx) => {
      if (!marketPositions[tx.marketId]) {
        marketPositions[tx.marketId] = {};
      }
      const marketState = marketPositions[tx.marketId];
      if (!marketState[tx.outcome]) {
        marketState[tx.outcome] = { qty: 0, cost: 0, realized: 0 };
      }
      const outcomeState = marketState[tx.outcome]!;

      if (tx.type === 'BUY') {
        const totalCost = outcomeState.qty * outcomeState.cost + tx.quantity * tx.price;
        outcomeState.qty += tx.quantity;
        outcomeState.cost = outcomeState.qty > 0 ? totalCost / outcomeState.qty : 0;
      } else {
        // SELL
        if (outcomeState.qty > 0) {
          const soldQty = Math.min(outcomeState.qty, tx.quantity);
          outcomeState.realized += soldQty * (tx.price - outcomeState.cost);
          outcomeState.qty -= soldQty;
        }
      }
    });

    const activePositions: Position[] = [];
    let sumRealized = 0;

    Object.entries(marketPositions).forEach(([marketId, outcomes]) => {
      const market = markets.find((m) => m.id === marketId);
      
      ['YES', 'NO'].forEach((outcomeStr) => {
        const outcome = outcomeStr as 'YES' | 'NO';
        const state = outcomes[outcome];
        if (state) {
          sumRealized += state.realized;
          if (state.qty > 0) {
            const currentYesPrice = market?.yesPrice ?? 0.5;
            const currentNoPrice = market?.noPrice ?? (1 - currentYesPrice);
            const currentPrice = outcome === 'YES' ? currentYesPrice : currentNoPrice;
            const currentValue = state.qty * currentPrice;
            const unrealizedPnL = currentValue - state.qty * state.cost;
            const unrealizedPnLPercent = state.cost > 0 ? (unrealizedPnL / (state.qty * state.cost)) * 100 : 0;

            activePositions.push({
              marketId,
              marketQuestion: market?.question ?? 'Unknown Market',
              outcome,
              quantity: state.qty,
              averageEntryPrice: state.cost,
              currentPrice,
              currentValue,
              unrealizedPnL,
              unrealizedPnLPercent,
            });
          }
        }
      });
    });

    return {
      positions: activePositions,
      totalRealizedPnL: sumRealized,
    };
  }, [transactions, markets]);

  const portfolioSummary = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;

    positions.forEach((pos) => {
      totalValue += pos.currentValue;
      totalCost += pos.quantity * pos.averageEntryPrice;
    });

    const totalUnrealizedPnL = totalValue - totalCost;
    const totalUnrealizedPnLPercent = totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalUnrealizedPnL,
      totalUnrealizedPnLPercent,
      netAssetValue: totalValue + totalRealizedPnL, // simple formula
    };
  }, [positions, totalRealizedPnL]);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            PORTFOLIO TRACKER
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0', fontFamily: 'var(--font-mono)' }}>
            REAL-TIME POSITION VALUATION & TRANSACTION LEDGER
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            style={{
              padding: '6px 12px',
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent)',
              fontSize: '11px',
              fontWeight: 'bold',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            {isFormOpen ? 'CANCEL ENTRY' : '+ RECORD TRANSACTION'}
          </button>
          {transactions.length > 0 && (
            <button
              onClick={handleClearPortfolio}
              style={{
                padding: '6px 12px',
                background: 'rgba(255, 82, 82, 0.05)',
                border: '1px solid rgba(255, 82, 82, 0.2)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--red)',
                fontSize: '11px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              RESET
            </button>
          )}
        </div>
      </div>

      {/* Transaction Entry Form */}
      {isFormOpen && (
        <form
          onSubmit={handleAddTransaction}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
          className="animate-fade-in"
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            RECORD NEW TRANSACTION
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {/* Market Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>TARGET MARKET</label>
              <select
                value={txMarketId}
                onChange={(e) => {
                  setTxMarketId(e.target.value);
                  const selected = markets.find((m) => m.id === e.target.value);
                  if (selected) {
                    const currentYesPrice = selected.yesPrice ?? 0.5;
                    setTxPrice(txOutcome === 'YES' ? currentYesPrice.toFixed(2) : (1 - currentYesPrice).toFixed(2));
                  }
                }}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="">Select a market...</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.question.substring(0, 60)}...
                  </option>
                ))}
              </select>
            </div>

            {/* Outcome Toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OUTCOME</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOutcomeChange('YES')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: txOutcome === 'YES' ? 'rgba(0, 230, 118, 0.1)' : 'var(--bg-primary)',
                    border: txOutcome === 'YES' ? '1px solid var(--green)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: txOutcome === 'YES' ? 'var(--green)' : 'var(--text-secondary)',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                  }}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => handleOutcomeChange('NO')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: txOutcome === 'NO' ? 'rgba(255, 82, 82, 0.1)' : 'var(--bg-primary)',
                    border: txOutcome === 'NO' ? '1px solid var(--red)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: txOutcome === 'NO' ? 'var(--red)' : 'var(--text-secondary)',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                  }}
                >
                  NO
                </button>
              </div>
            </div>

            {/* Type: BUY / SELL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>TRANSACTION TYPE</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTxType('BUY')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: txType === 'BUY' ? 'var(--accent-glow)' : 'var(--bg-primary)',
                    border: txType === 'BUY' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: txType === 'BUY' ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                  }}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('SELL')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: txType === 'SELL' ? 'rgba(255,255,255,0.05)' : 'var(--bg-primary)',
                    border: txType === 'SELL' ? '1px solid var(--text-primary)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: txType === 'SELL' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                  }}
                >
                  SELL
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>QUANTITY (CONTRACTS)</label>
              <input
                type="number"
                value={txQuantity}
                onChange={(e) => setTxQuantity(e.target.value)}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Price */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PRICE PER CONTRACT ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="0.99"
                value={txPrice}
                onChange={(e) => setTxPrice(e.target.value)}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              padding: '10px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--bg-primary)',
              fontWeight: 'bold',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            SUBMIT LEDGER ENTRY
          </button>
        </form>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>PORTFOLIO VALUE</span>
          <span style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
            ${portfolioSummary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Total Cost Basis: ${portfolioSummary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>UNREALIZED P&L</span>
          <span style={{
            fontSize: '24px',
            fontWeight: 'bold',
            fontFamily: 'var(--font-mono)',
            color: portfolioSummary.totalUnrealizedPnL > 0 ? 'var(--green)' : portfolioSummary.totalUnrealizedPnL < 0 ? 'var(--red)' : 'var(--text-secondary)'
          }}>
            {portfolioSummary.totalUnrealizedPnL > 0 ? '+' : ''}
            ${portfolioSummary.totalUnrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: 'bold',
            color: portfolioSummary.totalUnrealizedPnL > 0 ? 'var(--green)' : portfolioSummary.totalUnrealizedPnL < 0 ? 'var(--red)' : 'var(--text-muted)'
          }}>
            {portfolioSummary.totalUnrealizedPnL > 0 ? '+' : ''}
            {portfolioSummary.totalUnrealizedPnLPercent.toFixed(2)}%
          </span>
        </div>

        <div style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>REALIZED P&L</span>
          <span style={{
            fontSize: '24px',
            fontWeight: 'bold',
            fontFamily: 'var(--font-mono)',
            color: totalRealizedPnL > 0 ? 'var(--green)' : totalRealizedPnL < 0 ? 'var(--red)' : 'var(--text-secondary)'
          }}>
            {totalRealizedPnL > 0 ? '+' : ''}
            ${totalRealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Net Portfolio P&L: ${(portfolioSummary.totalUnrealizedPnL + totalRealizedPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Active Positions Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', margin: 0 }}>
          ACTIVE POSITIONS ({positions.length})
        </h2>

        {positions.length > 0 ? (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>PREDICTION CONTRACT</th>
                  <th style={{ padding: '12px 16px' }}>POSITION</th>
                  <th style={{ padding: '12px 16px' }}>QTY</th>
                  <th style={{ padding: '12px 16px' }}>AVG ENTRY</th>
                  <th style={{ padding: '12px 16px' }}>MARKET PRICE</th>
                  <th style={{ padding: '12px 16px' }}>VALUE</th>
                  <th style={{ padding: '12px 16px' }}>UNREALIZED P&L</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => {
                  const targetMarket = markets.find((m) => m.id === pos.marketId);
                  return (
                    <tr
                      key={`${pos.marketId}-${pos.outcome}`}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                      className="hover:bg-white/[0.015]"
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 500, maxWidth: '280px' }}>
                        <button
                          onClick={() => targetMarket && onSelectMarket(targetMarket)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#FFF',
                            textAlign: 'left',
                            cursor: 'pointer',
                            padding: 0,
                            fontFamily: 'inherit',
                            fontSize: 'inherit',
                            fontWeight: 'inherit',
                            outline: 'none',
                          }}
                          className="hover:underline hover:text-[#00d4ff]"
                        >
                          {pos.marketQuestion}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: pos.outcome === 'YES' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 82, 82, 0.1)',
                          color: pos.outcome === 'YES' ? 'var(--green)' : 'var(--red)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px'
                        }}>
                          {pos.outcome}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                        {pos.quantity.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                        ${pos.averageEntryPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                        ${pos.currentPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        ${pos.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 'bold',
                        color: pos.unrealizedPnL > 0 ? 'var(--green)' : pos.unrealizedPnL < 0 ? 'var(--red)' : 'var(--text-secondary)'
                      }}>
                        {pos.unrealizedPnL > 0 ? '+' : ''}
                        ${pos.unrealizedPnL.toFixed(2)} ({pos.unrealizedPnLPercent.toFixed(1)}%)
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleClosePosition(pos)}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(255, 82, 82, 0.05)',
                            border: '1px solid rgba(255, 82, 82, 0.2)',
                            borderRadius: '4px',
                            color: 'var(--red)',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                          }}
                          className="hover:bg-red-500/10 transition-all"
                        >
                          CLOSE
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '32px', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            NO ACTIVE TRADING POSITIONS DETECTED
          </div>
        )}
      </div>

      {/* Transaction History Log Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', margin: 0 }}>
          TRANSACTION LOGS ({transactions.length})
        </h2>

        {transactions.length > 0 ? (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 16px' }}>DATE/TIME</th>
                  <th style={{ padding: '10px 16px' }}>MARKET</th>
                  <th style={{ padding: '10px 16px' }}>TYPE</th>
                  <th style={{ padding: '10px 16px' }}>OUTCOME</th>
                  <th style={{ padding: '10px 16px' }}>QTY</th>
                  <th style={{ padding: '10px 16px' }}>PRICE</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    className="hover:bg-white/[0.01]"
                  >
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-primary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.marketQuestion}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        color: tx.type === 'BUY' ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: 'bold',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        color: tx.outcome === 'YES' ? 'var(--green)' : 'var(--red)',
                        fontWeight: 'bold',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {tx.outcome}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)' }}>
                      {tx.quantity.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)' }}>
                      ${tx.price.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      ${(tx.quantity * tx.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '24px', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            NO RECORDED TRANSACTION HISTORY
          </div>
        )}
      </div>

    </div>
  );
}
