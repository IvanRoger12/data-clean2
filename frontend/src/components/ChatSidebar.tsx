import React, { useEffect, useRef, useState } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

export default function ChatSidebar() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Salut ! Je suis votre assistant IA spécialisé en nettoyage de données. Uploadez un fichier et je vous aiderai à l'analyser !" }
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, typing])

  const ask = async (text: string) => {
    setMessages(m => [...m, { role: 'user', content: text }])
    setInput('')
    setTyping(true)
    try {
      const r = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Tu es un assistant IA expert en qualité des données. Donne des réponses brèves, pragmatiques, et actionnables.' },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text }
          ]
        })
      })
      const j = await r.json()
      const content = j?.content || j?.choices?.[0]?.message?.content || "Désolé, pas de réponse."
      setMessages(m => [...m, { role: 'assistant', content }])
    } catch (e:any) {
      setMessages(m => [...m, { role: 'assistant', content: "Erreur d'appel API. Vérifie OPENAI_API_KEY dans Vercel." }])
    } finally {
      setTyping(false)
    }
  }

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || typing) return
    ask(msg)
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggested = [
    "Comment nettoyer cette colonne ?",
    "Quels sont les doublons détectés ?",
    "Recommande-moi des règles de validation",
    "Explique-moi ces anomalies"
  ]

  return (
    <aside className="sidebar">
      <div className="chat-header">
        <div className="assistant-icon">🤖</div>
        <div className="assistant-info">
          <h3>Assistant IA</h3>
          <p>Expert en nettoyage de données</p>
        </div>
      </div>

      <div className="chat-messages" ref={scrollRef} id="chatMessages">
        {/* Messages */}
        {messages.map((m, i) => (
          <div className={`message ${m.role==='user'?'user':''}`} key={i}>
            <div className={`message-avatar ${m.role==='user'?'avatar-user':'avatar-ai'}`}>{m.role==='user'?'👤':'🤖'}</div>
            <div className="message-content">{m.content}</div>
          </div>
        ))}

        {/* Suggestions */}
        <div className="suggested-questions" style={{ marginTop: '.5rem' }}>
          {suggested.map(s => (
            <button key={s} className="suggested-question" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="chat-input-container">
        {typing && (
          <div className="typing-indicator" id="typingIndicator">
            L'IA réfléchit
            <div className="typing-dots">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}
        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            id="chatInput"
            placeholder="Posez votre question sur vos données..."
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="send-button" onClick={handleSend} disabled={typing}>➤</button>
        </div>
      </div>
    </aside>
  )
}
