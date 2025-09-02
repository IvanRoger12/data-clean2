import React, { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; text: string };

const suggested = [
  "Quels sont les doublons détectés ?",
  "Recommande-moi des règles de validation",
  "Explique-moi ces anomalies"
];

export default function ChatDrawer() {
  const [msgs, setMsgs] = useState<Message[]>([
    {
      role: "assistant",
      text:
        "Salut ! Je suis votre assistant IA spécialisé en nettoyage de données. Uploadez un fichier et je vous aiderai à l'analyser !"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [msgs, loading]);

  async function askLLM(prompt: string): Promise<string> {
    try {
      const res = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) {
        // Fallback local si pas de clé
        return "⚠️ L'API IA n'est pas configurée côté serveur. Je peux quand même vous guider : commencez par standardiser les emails (RFC), les dates (ISO 8601) et les téléphones (E.164).";
      }
      const data = await res.json();
      return data?.text ?? "Je n'ai pas pu répondre cette fois.";
    } catch {
      return "⚠️ Réseau indisponible. Réessayez plus tard.";
    }
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setLoading(true);
    const reply = await askLLM(message);
    setMsgs((m) => [...m, { role: "assistant", text: reply }]);
    setLoading(false);
  }

  return (
    <aside className="chat-drawer">
      <div className="chat-header">
        <div className="avatar">🤖</div>
        <div>
          <div style={{ fontWeight: 700 }}>Assistant IA</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Expert en nettoyage de données
          </div>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {/* Suggestions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {suggested.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              style={{
                textAlign: "left",
                background: "rgba(74,163,255,.12)",
                border: "1px solid rgba(74,163,255,.35)",
                padding: "8px 10px",
                borderRadius: 10,
                color: "#4aa3ff",
                cursor: "pointer"
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        {msgs.map((m, i) => (
          <div className={`msg ${m.role === "user" ? "user" : ""}`} key={i}>
            {m.role !== "user" && <div className="avatar">🤖</div>}
            <div className="bubble">{m.text}</div>
            {m.role === "user" && (
              <div className="avatar" style={{ background: "#4aa3ff" }}>
                👤
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="msg">
            <div className="avatar">🤖</div>
            <div className="bubble" style={{ opacity: 0.8 }}>
              L’IA réfléchit…
            </div>
          </div>
        )}
      </div>

      <div className="input-row">
        <textarea
          value={input}
          placeholder="Posez votre question…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}>
          ➤
        </button>
      </div>
    </aside>
  );
}
