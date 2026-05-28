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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono">
      {/* Central Terminal Panel */}
      <div className="relative w-full max-w-4xl h-[85vh] bg-[#0d1219] border border-[#1e2a38] rounded-lg shadow-[0_0_50px_rgba(0,212,255,0.15)] flex flex-col overflow-hidden">
        {/* Top bar header */}
        <div className="p-4 border-b border-[#1e2a38] flex items-center justify-between shrink-0 bg-[#080c10]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4ff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00d4ff]"></span>
            </span>
            <h2 className="text-sm font-bold text-white tracking-widest uppercase">
              ALPHA·CAST CHAT TERMINAL
            </h2>
            <span className="text-[9px] font-bold bg-[#00d4ff]/10 text-[#00d4ff] px-2 py-0.5 rounded border border-[#00d4ff]/20">
              GLOBAL INTEL
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-all cursor-pointer text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Message Feed History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080c10]/40 flex flex-col no-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-end space-y-6 pb-4">
              {/* Terminal Greeting block */}
              <div className="p-5 border border-[#1e2a38] bg-[#080c10]/90 rounded-lg max-w-2xl space-y-3 shadow-inner">
                <p className="text-[#00d4ff] font-bold text-sm tracking-wide">
                  &gt; ALPHA·CAST Terminal Active.
                </p>
                <p className="text-xs text-slate-300 leading-relaxed font-sans select-text">
                  Welcome to the global intelligence desk. I have direct connection to external web search scraping and live predictive mapping. Ask me about any Polymarket question by name—e.g. digital asset thresholds, elections, culture, or mathematical position sizing formulas.
                </p>
              </div>

              {/* Starter suggested chips */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 font-mono">
                  Select a starter query:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {starterQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="text-left p-3.5 rounded border border-[#1e2a38] bg-[#080c10] text-xs text-[#00d4ff] hover:bg-[#00d4ff]/10 hover:border-[#00d4ff]/40 transition-all cursor-pointer font-semibold font-mono leading-relaxed"
                    >
                      &gt; {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 flex-1">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                  >
                    <span className="text-[9px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest font-mono">
                      {isUser ? 'Trader' : 'ALPHA·CAST Analyst'}
                    </span>
                    <div
                      className={`px-4 py-3 rounded-lg text-xs leading-relaxed select-text border shadow-md ${
                        isUser
                          ? 'bg-[#0d1219] text-slate-200 border-[#1e2a38] font-sans'
                          : 'bg-[#080c10] text-slate-200 border-[#00d4ff]/20 font-mono text-[13px] leading-relaxed whitespace-pre-wrap'
                      }`}
                    >
                      {!isUser && <span className="text-[#00d4ff] font-bold">&gt; </span>}
                      {msg.content}
                    </div>
                  </div>
                );
              })}

              {/* Live Web Searching typing indicator */}
              {loading && (
                <div className="mr-auto items-start flex flex-col max-w-[85%] animate-pulse">
                  <span className="text-[9px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest font-mono">
                    ALPHA·CAST Analyst
                  </span>
                  <div className="px-4 py-3 rounded-lg text-xs bg-[#080c10] text-[#00d4ff] border border-[#00d4ff]/20 font-mono text-[13px]">
                    &gt; Scraping live odds data and executing web queries...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Message bar */}
        <div className="p-4 border-t border-[#1e2a38] bg-[#0d1219] shrink-0">
          <form onSubmit={handleFormSubmit} className="flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={loading}
              placeholder="Ask ALPHA·CAST about any prediction market by question name..."
              className="flex-1 bg-[#080c10] border border-[#1e2a38] focus:border-[#00d4ff]/60 focus:ring-1 focus:ring-[#00d4ff]/20 text-slate-100 placeholder-slate-600 outline-none text-xs px-4 py-3 rounded font-mono transition-all"
            />
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="px-6 py-3 bg-[#00d4ff]/10 border border-[#00d4ff] hover:bg-[#00d4ff]/20 hover:border-[#00d4ff] text-[#00d4ff] font-bold text-xs transition-all rounded disabled:opacity-30 transition-all cursor-pointer shrink-0 font-mono"
            >
              RESOLVE INTEL
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
