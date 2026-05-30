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
}

export default function ChatPanel({ market, analysis, markets, chatFocusTrigger }: ChatPanelProps) {
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
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#0d1219] border-l border-[#1e2a38] select-none text-center font-mono">
        <div className="space-y-2">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">
            [PolyDict Chat Standby]
          </div>
          <p className="text-[11px] text-slate-600 max-w-[220px] mx-auto leading-relaxed font-sans">
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
    <div className="h-full flex flex-col bg-[#0d1219] border-l border-[#1e2a38] overflow-hidden select-text font-mono">
      {/* Panel Top Label */}
      <div className="p-4 border-b border-[#1e2a38] bg-[#0d1219] shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 tracking-wider">
            AI Analyst Chat
          </span>
          <span className={`text-[10px] border px-2 py-0.5 rounded font-bold uppercase ${getVerdictBadgeColor(analysis?.verdict)}`}>
            {analysis?.verdict || 'SKIP'} MODE
          </span>
        </div>
      </div>

      {/* Message Feed History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-[#080c10]/20 flex flex-col">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-end space-y-4 pb-2">
            {/* Initial Welcome message */}
            <div className="p-3.5 border border-[#1e2a38] bg-[#080c10] rounded text-xs text-slate-400 space-y-2">
              <p className="text-[#00d4ff] font-bold tracking-wide font-mono">
                &gt; PolyDict Analyst:
              </p>
              <p className="leading-relaxed select-text font-sans text-xs text-slate-300">
                Discuss the resolution criteria, sentiment indicators, and tail risks of this contract. I can run live search filters on command.
              </p>
            </div>

            {/* Clickable Suggested starter chips */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 font-mono">
                Suggested Questions
              </div>
              <div className="flex flex-col gap-2">
                {suggestedQuestions.map((q: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="w-full text-left px-3.5 py-2.5 rounded border border-[#1e2a38] bg-[#080c10] text-[11px] text-[#00d4ff] hover:bg-[#00d4ff]/10 hover:border-[#00d4ff]/40 transition-all cursor-pointer font-semibold font-mono truncate"
                  >
                    &gt; {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 flex-1">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[95%] ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  {/* Sender label & Copy action */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                      {isUser ? 'User' : 'PolyDict Agent'}
                    </span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopyMessage(msg.content, idx)}
                        className="text-[9px] text-[#00d4ff] hover:text-[#00e676] bg-transparent border-none cursor-pointer font-bold transition-all uppercase tracking-wider flex items-center gap-0.5"
                      >
                        {copiedId === idx ? '✓ Copied' : '⧉ Copy'}
                      </button>
                    )}
                  </div>

                  {/* Text bubble */}
                  <div
                    className={`px-3 py-2 rounded text-xs select-text leading-relaxed border ${isUser
                      ? 'bg-[#0d1219] text-slate-200 border-[#1e2a38] font-sans'
                      : 'bg-[#080c10] text-slate-200 border-[#00d4ff]/20 font-mono text-[11px]'
                      }`}
                  >
                    {!isUser && <span className="text-[#00d4ff] font-bold">&gt; </span>}
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="mr-auto items-start flex flex-col max-w-[95%]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                    PolyDict Agent
                  </span>
                </div>
                <div className="px-3 py-2 rounded text-xs bg-[#080c10] text-[#00d4ff] border border-[#00d4ff]/20 font-mono text-[11px] matrix-cursor">
                  &gt; Resolving web & X metrics
                </div>
              </div>
            )}

            {/* Clickable Suggested follow-up chips (rendered at the bottom of messages list) */}
            {suggestedQuestions && suggestedQuestions.length > 0 && !loading && (
              <div className="pt-4 space-y-2 mt-4 border-t border-[#1e2a38]/50">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono px-1">
                  Suggested Follow-Ups:
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="text-left px-3 py-1.5 rounded border border-[#1e2a38] bg-[#080c10] text-[10px] font-mono text-[#00d4ff] hover:bg-[#00d4ff]/10 hover:border-[#00d4ff]/40 transition-all cursor-pointer font-semibold max-w-full truncate"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>
        )}
      </div>

      {/* Bottom Message Input form with Injected Context Badge and Comparison Chip */}
      <div className="border-t border-[#1e2a38] bg-[#0d1219] shrink-0 flex flex-col">
        {/* Comparison Chip Banner */}
        {detectedMarket && (
          <div className="mx-3 mt-2.5 p-2 rounded border border-[#ffab40]/30 bg-[#ffab40]/[0.02] text-[10px] font-mono text-[#ffab40] flex items-center justify-between gap-2 animate-fade-in shrink-0">
            <span className="truncate">
              Compare with: <strong className="text-slate-200">"{detectedMarket.question.slice(0, 40)}..."</strong>
            </span>
            <button
              type="button"
              onClick={() => loadComparisonContext(detectedMarket)}
              className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-[#ffab40]/40 bg-[#ffab40]/10 rounded hover:bg-[#ffab40]/20 text-[#ffab40] cursor-pointer transition-all active:scale-[0.97] shrink-0"
            >
              Load context
            </button>
          </div>
        )}

        {/* Context Injected Alert */}
        {injectedComparisonContext && (
          <div className="mx-3 mt-2.5 p-2 rounded border border-[#00e676]/30 bg-[#00e676]/[0.02] text-[10px] font-mono text-[#00e676] flex items-center justify-between gap-2 animate-fade-in shrink-0">
            <span>
              ✓ Comparison context loaded (will send on next message)
            </span>
            <button
              type="button"
              onClick={() => setInjectedComparisonContext(null)}
              className="text-slate-400 hover:text-[#ff5252] text-xs px-1 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="p-3 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={loading}
            placeholder="Ask agent regarding contract..."
            className="flex-1 bg-[#080c10] border border-[#1e2a38] focus:border-[#00d4ff]/60 focus:ring-1 focus:ring-[#00d4ff]/20 text-slate-100 placeholder-slate-600 outline-none text-xs px-3 py-2.5 rounded font-mono transition-all"
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="px-4 py-2 bg-[#00d4ff]/10 border border-[#00d4ff] hover:bg-[#00d4ff]/20 hover:border-[#00d4ff] text-[#00d4ff] font-bold text-xs transition-all rounded disabled:opacity-30 transition-all cursor-pointer shrink-0 font-mono"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

