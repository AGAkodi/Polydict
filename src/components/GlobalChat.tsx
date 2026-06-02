import React, { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface GlobalChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalChat({ isOpen, onClose }: GlobalChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, loading, isOpen]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market: null,
          analysis: null,
          signals: null,
          history: messages,
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error('Global chat agent disconnected');
      }

      const data = await response.json();
      const assistantMsg: Message = { role: 'assistant', content: data.reply };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Global Chat error:', err);
      const errMsg: Message = {
        role: 'assistant',
        content: `SYS_ERR: Global connection terminated. Reason: ${err.message || 'Agent offline'}.`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      handleSendMessage(inputMessage);
    }
  };

  const starterQuestions = [
    'What are the current Polymarket odds for Bitcoin hitting $100k?',
    'What are the key active election and political contracts right now?',
    'Steelman the bear case for the latest AI prediction markets',
    'How do I size a position with a 12% edge at 65% odds using Kelly?',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0f14]/80 backdrop-blur-md animate-fade-in">
      {/* Central Terminal Panel */}
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 0 24px rgba(0, 209, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          maxWidth: '896px', // 4xl
          height: '80vh',
        }}
      >
        {/* Top bar header */}
        <div
          style={{
            height: '48px',
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
          className="shrink-0"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d1ff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d1ff]"></span>
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: 'var(--accent)',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              ALPHA·CAST CHAT TERMINAL
            </h2>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: '600',
                background: 'rgba(0, 209, 255, 0.1)',
                color: 'var(--accent)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(0, 209, 255, 0.2)',
                letterSpacing: '0.05em',
              }}
            >
              GLOBAL INTEL
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: 'var(--text-muted)',
              transition: 'color 0.15s',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              padding: '4px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            ✕
          </button>
        </div>

        {/* Message Feed History */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: 'transparent',
          }}
          className="no-scrollbar"
        >
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'end', gap: '20px', paddingBottom: '8px' }}>
              {/* Terminal Greeting block */}
              <div
                style={{
                  padding: '16px 20px',
                  border: '1px solid var(--border)',
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderRadius: 'var(--radius-sm)',
                  maxWidth: '640px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent)',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    margin: '0 0 8px 0',
                    letterSpacing: '0.05em',
                  }}
                >
                  &gt; ALPHA·CAST Terminal Active.
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    margin: 0,
                    lineHeight: '1.6',
                  }}
                >
                  Welcome to the global intelligence desk. I have direct connection to external web search scraping and live predictive mapping. Ask me about any Polymarket question by name—e.g. digital asset thresholds, elections, culture, or mathematical position sizing formulas.
                </p>
              </div>

              {/* Starter suggested chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: '600',
                    letterSpacing: '0.1em',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Select a starter query:
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {starterQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      style={{
                        padding: '10px 14px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        color: 'var(--accent)',
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        lineHeight: '1.5',
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
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: '600',
                        letterSpacing: '0.1em',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {isUser ? 'Trader' : 'ALPHA·CAST Analyst'}
                    </span>
                    <div
                      style={isUser ? {
                        alignSelf: 'flex-end',
                        background: 'rgba(0, 209, 255, 0.08)',
                        border: '1px solid rgba(0, 209, 255, 0.15)',
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
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {!isUser && <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>&gt; </span>}
                      {msg.content}
                    </div>
                  </div>
                );
              })}

              {/* Live Web Searching typing indicator */}
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', maxWidth: '90%', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: '600',
                      letterSpacing: '0.1em',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      marginBottom: '4px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    ALPHA·CAST Analyst
                  </span>
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
                    &gt; Scraping live odds data and executing web queries...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} style={{ height: '4px' }} />
            </div>
          )}
        </div>

        {/* Input Message bar */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
          }}
          className="shrink-0"
        >
          <form
            onSubmit={handleFormSubmit}
            style={{
              padding: '16px 20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={loading}
              placeholder="Ask ALPHA·CAST about any prediction market by question name..."
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
                padding: '0 20px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                height: '40px',
                opacity: loading || !inputMessage.trim() ? 0.35 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
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
              RESOLVE INTEL
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
