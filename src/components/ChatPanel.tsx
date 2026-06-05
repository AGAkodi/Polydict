import React, { useState, useRef, useEffect } from 'react';
import { MergedMarket } from '../utils/polymarket';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  market: MergedMarket | null;
  analysis: any; // AnalysisResult from prediction card
  markets?: MergedMarket[]; // All markets for cross-market comparisons
  chatFocusTrigger?: number;
  marketSentiment?: any;
  className?: string;
}

export default function ChatPanel({ market, analysis, markets, chatFocusTrigger, marketSentiment, className }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [detectedMarket, setDetectedMarket] = useState<MergedMarket | null>(null);
  const [injectedComparisonContext, setInjectedComparisonContext] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (chatFocusTrigger !== undefined && chatFocusTrigger > 0) {
      inputRef.current?.focus();
    }
  }, [chatFocusTrigger]);

  const handleCopyMessage = (text: string, id: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Reset messages when market changes
  useEffect(() => {
    setMessages([]);
    setInputMessage('');
    setLoading(false);
    setDetectedMarket(null);
    setInjectedComparisonContext(null);
  }, [market]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !market || loading) return;

    let finalMessageToSend = text;
    if (injectedComparisonContext) {
      finalMessageToSend = text + injectedComparisonContext;
      setInjectedComparisonContext(null);
    }

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market,
          analysis,
          signals: analysis?.signals ?? analysis?.grokSignals ?? null,
          history: messages,
          message: finalMessageToSend,
          marketSentiment,
        }),
      });

      if (!response.ok) {
        throw new Error('Chat agent disconnected');
      }

      const data = await response.json();
      const assistantMsg: Message = { role: 'assistant', content: data.reply };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errMsg: Message = {
        role: 'assistant',
        content: `SYS_ERR: Direct connection terminated. Reason: ${err.message || 'Agent offline'}.`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (val: string) => {
    setInputMessage(val);
    if (!val.trim()) {
      setDetectedMarket(null);
      return;
    }

    const matched = markets?.find(
      (m: any) =>
        m.id !== market?.id &&
        val.toLowerCase().includes(m.question.toLowerCase().slice(0, 20).toLowerCase())
    );
    setDetectedMarket(matched || null);
  };

  const loadComparisonContext = (target: MergedMarket) => {
    const contextBlock = `\n\n--- INJECTED COMPARISON MARKET CONTEXT ---
Question: "${target.question}"
Category: ${target.category}
Current YES price: ${(target.yesPrice * 100).toFixed(1)}% (${target.yesPrice})
Current NO price: ${(target.noPrice * 100).toFixed(1)}% (${target.noPrice})
Volume: $${target.volume.toLocaleString()}
Ends: ${target.endDate}
Description: ${target.description ?? 'N/A'}
--------------------------------------------`;

    setInjectedComparisonContext(contextBlock);
    setDetectedMarket(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      handleSendMessage(inputMessage);
    }
  };

  if (!market) {
    return (
      <div 
        className={className}
        style={{
          height: '100%',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          userSelect: 'none',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            [PolyDict Chat Standby]
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '220px', margin: '0 auto', lineHeight: '1.6', fontFamily: 'var(--font-sans)' }}>
            Select a market from the sidebar to open the AI prediction chat channel.
          </p>
        </div>
      </div>
    );
  }

  // Define suggested questions chips
  const defaultSuggestions = [
    "What's the bear case?",
    "How should I size this position?",
    "What would flip your verdict?",
    "What are the key dates to watch?",
    "Steelman the other side",
  ];

  const suggestedQuestions = analysis?.suggestedQuestions || defaultSuggestions;

  const getVerdictBadgeColor = (v?: string) => {
    switch (v) {
      case 'YES':
        return 'text-[#00e676] bg-[#00e676]/10 border-[#00e676]/30';
      case 'NO':
        return 'text-[#ff5252] bg-[#ff5252]/10 border-[#ff5252]/30';
      case 'SKIP':
      default:
        return 'text-[#ffab40] bg-[#ffab40]/10 border-[#ffab40]/30';
    }
  };

  return (
    <div 
      className={className}
      style={{
        height: '100%',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Panel Top Label */}
      <div 
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
        }}
        className="shrink-0"
      >
        <span 
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}
        >
          AI Analyst Chat
        </span>
        <span 
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: analysis?.verdict === 'YES' ? 'var(--green-glow)' : 
                        analysis?.verdict === 'NO' ? 'var(--red-glow)' : 'var(--amber-glow)',
            borderColor: analysis?.verdict === 'YES' ? 'rgba(0, 230, 118, 0.2)' : 
                         analysis?.verdict === 'NO' ? 'rgba(255, 82, 82, 0.2)' : 'rgba(255, 183, 77, 0.2)',
            color: analysis?.verdict === 'YES' ? 'var(--green)' : 
                   analysis?.verdict === 'NO' ? 'var(--red)' : 'var(--amber)',
          }}
        >
          {analysis?.verdict || 'SKIP'} MODE
        </span>
      </div>

      {/* Message Feed History */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
        className="no-scrollbar"
      >
        {messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'end', gap: '16px', paddingBottom: '8px' }}>
            {/* Initial Welcome message */}
            <div 
              style={{
                alignSelf: 'flex-start',
                maxWidth: '90%',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '2px 12px 12px 12px',
                padding: '10px 14px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                lineHeight: '1.6',
              }}
            >
              <div 
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                }}
              >
                PolyDict Analyst
              </div>
              Discuss the resolution criteria, sentiment indicators, and tail risks of this contract. I can run live search filters on command.
            </div>

            {/* Clickable Suggested starter chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div 
                style={{
                  fontSize: '9px',
                  fontWeight: '600',
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  paddingLeft: '4px',
                }}
              >
                Suggested Questions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {suggestedQuestions.map((q: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--accent-glow)';
                      e.currentTarget.style.borderColor = 'var(--accent-border)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    &gt; {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: isUser ? '85%' : '90%',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  {/* Sender label & Copy action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span 
                      style={{
                        fontSize: '9px',
                        fontWeight: '600',
                        letterSpacing: '0.1em',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isUser ? 'User' : 'PolyDict Agent'}
                    </span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopyMessage(msg.content, idx)}
                        style={{
                          fontSize: '9px',
                          color: 'var(--accent)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          transition: 'color 0.15s',
                          padding: 0,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--green)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent)'}
                      >
                        {copiedId === idx ? '✓ Copied' : '⧉ Copy'}
                      </button>
                    )}
                  </div>

                  {/* Text bubble */}
                  <div
                    style={isUser ? {
                      alignSelf: 'flex-end',
                      background: 'rgba(0,209,255,0.08)',
                      border: '1px solid rgba(0,209,255,0.15)',
                      borderRadius: '12px 12px 2px 12px',
                      padding: '10px 14px',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      lineHeight: '1.55',
                      wordBreak: 'break-word',
                    } : {
                      alignSelf: 'flex-start',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px 12px 12px 12px',
                      padding: '10px 14px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      lineHeight: '1.6',
                      wordBreak: 'break-word',
                    }}
                  >
                    {!isUser && <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>&gt; </span>}
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', maxWidth: '90%', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span 
                    style={{
                      fontSize: '9px',
                      fontWeight: '600',
                      letterSpacing: '0.1em',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    PolyDict Agent
                  </span>
                </div>
                <div
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '2px 12px 12px 12px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: '1.6',
                  }}
                  className="matrix-cursor animate-pulse"
                >
                  &gt; Resolving web & X metrics
                </div>
              </div>
            )}

            {/* Clickable Suggested follow-up chips */}
            {suggestedQuestions && suggestedQuestions.length > 0 && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '12px' }}>
                <div 
                  style={{
                    fontSize: '9px',
                    fontWeight: '600',
                    letterSpacing: '0.1em',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    paddingLeft: '4px',
                  }}
                >
                  Suggested Follow-Ups:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {suggestedQuestions.map((q: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      style={{
                        padding: '6px 10px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '10px',
                        color: 'var(--accent)',
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        maxWidth: '100%',
                        outline: 'none',
                      }}
                      className="truncate"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--accent-glow)';
                        e.currentTarget.style.borderColor = 'var(--accent-border)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} style={{ height: '2px' }} />
          </div>
        )}
      </div>

      {/* Bottom Message Input form */}
      <div 
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="shrink-0"
      >
        {/* Comparison Chip Banner */}
        {detectedMarket && (
          <div 
            style={{
              margin: '8px 12px 0 12px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255, 183, 77, 0.2)',
              background: 'var(--amber-glow)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--amber)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
            className="animate-fade-in shrink-0"
          >
            <span className="truncate">
              Compare with: <strong style={{ color: 'var(--text-primary)' }}>"{detectedMarket.question.slice(0, 35)}..."</strong>
            </span>
            <button
              type="button"
              onClick={() => loadComparisonContext(detectedMarket)}
              style={{
                padding: '2px 6px',
                fontSize: '8px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                border: '1px solid rgba(255, 183, 77, 0.3)',
                background: 'rgba(255, 183, 77, 0.1)',
                color: 'var(--amber)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Load context
            </button>
          </div>
        )}

        {/* Context Injected Alert */}
        {injectedComparisonContext && (
          <div 
            style={{
              margin: '8px 12px 0 12px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(0, 230, 118, 0.2)',
              background: 'var(--green-glow)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
            className="animate-fade-in shrink-0"
          >
            <span>
              ✓ Comparison context loaded (will send on next message)
            </span>
            <button
              type="button"
              onClick={() => setInjectedComparisonContext(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '0 4px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleFormSubmit} style={{ padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={loading}
            placeholder="Ask agent regarding contract..."
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-sans)',
              padding: '10px 14px',
              outline: 'none',
              transition: 'border-color 0.15s',
              height: '40px',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-border)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            style={{
              background: loading || !inputMessage.trim() ? 'rgba(0,209,255,0.03)' : 'rgba(0,209,255,0.1)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: '600',
              padding: '10px 16px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              height: '40px',
              opacity: loading || !inputMessage.trim() ? 0.35 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading && inputMessage.trim()) {
                e.currentTarget.style.background = 'rgba(0,209,255,0.18)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && inputMessage.trim()) {
                e.currentTarget.style.background = 'rgba(0,209,255,0.1)';
              }
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

