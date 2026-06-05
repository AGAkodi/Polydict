"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function GlobalChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: null,
          analysis: null,
          signals: null,
          history: messages,
          message: text,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: open ? "768px" : "384px",
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          background: "var(--accent)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          boxShadow: "0 0 20px rgba(0,209,255,0.4)",
          zIndex: 1000,
          transition: "right 0.3s ease",
          color: "#0B0F14",
          fontWeight: "bold",
        }}
        title="Ask about any market"
      >
        {open ? "×" : "◎"}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "384px",
          width: "360px",
          height: "500px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--accent-border)",
          borderRadius: "var(--radius)",
          display: "flex",
          flexDirection: "column",
          zIndex: 999,
          boxShadow: "0 0 40px rgba(0,209,255,0.1)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: "600",
                color: "var(--accent)",
                letterSpacing: "0.1em",
              }}>
                GLOBAL ANALYST DESK
              </span>
              <p style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--text-muted)",
                marginTop: "2px",
              }}>
                Ask about any Polymarket prediction
              </p>
            </div>
            <div style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--green)",
              boxShadow: "0 0 6px var(--green)",
              animation: "pulse 2s ease-in-out infinite",
            }} />
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}>
            {messages.length === 0 && (
              <div style={{ padding: "8px 0" }}>
                <p style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  lineHeight: "1.6",
                  marginBottom: "12px",
                }}>
                  Global analyst desk active. Ask me about any market by name — I will search for live odds and give you a sharp take.
                </p>
                {[
                  "What are the top crypto markets right now?",
                  "What is the current odds on the next US election?",
                  "Which sports markets have the most edge today?",
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      marginBottom: "6px",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--accent)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  background: msg.role === "user"
                    ? "rgba(0,209,255,0.08)"
                    : "var(--bg-card)",
                  border: `1px solid ${msg.role === "user" ? "rgba(0,209,255,0.15)" : "var(--border)"}`,
                  borderRadius: msg.role === "user"
                    ? "12px 12px 2px 12px"
                    : "2px 12px 12px 12px",
                  padding: "10px 12px",
                  fontSize: "12px",
                  fontFamily: msg.role === "user" ? "var(--font-sans)" : "var(--font-mono)",
                  color: msg.role === "user" ? "var(--text-primary)" : "var(--text-secondary)",
                  lineHeight: "1.55",
                }}
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div style={{
                alignSelf: "flex-start",
                padding: "10px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "2px 12px 12px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--accent)",
              }}>
                Searching markets...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: "8px",
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about any market..."
              disabled={loading}
              style={{
                flex: 1,
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                padding: "8px 12px",
                outline: "none",
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              style={{
                background: "rgba(0,209,255,0.1)",
                border: "1px solid var(--accent-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                fontWeight: "600",
                padding: "8px 14px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              SEND
            </button>
          </div>
        </div>
      )}
    </>
  );
}
