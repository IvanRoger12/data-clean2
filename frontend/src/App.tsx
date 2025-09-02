// frontend/src/App.tsx
import React, { useMemo, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function App() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'stats' | 'schedule' | 'jobs'>('analyze');
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        "Salut ! Je suis votre assistant IA spécialisé en nettoyage de données. Uploadez un fichier et je vous aiderai à l'analyser !"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [lang, setLang] = useState<'FR' | 'EN'>('FR');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const suggested = useMemo(
    () => [
      'Comment nettoyer cette colonne ?',
      'Quels sont les doublons détectés ?',
      'Recommande-moi des règles de validation',
      'Explique-moi ces anomalies'
    ],
    []
  );

  const handleShowTab = (tab: typeof activeTab) => setActiveTab(tab);

  const addUserMessage = (content: string) => {
    setMessages((m) => [...m, { role: 'user', content }]);
  };

  const addAIMessage = (content: string) => {
    setMessages((m) => [...m, { role: 'assistant', content }]);
  };

  const askQuestion = (q: string) => {
    (document.getElementById('chatInput') as HTMLTextAreaElement).value = q;
    sendMessage();
  };

  const sendMessage = async () => {
    if (isTyping) return;
    const input = document.getElementById('chatInput') as HTMLTextAreaElement;
    const content = (input.value || '').trim();
    if (!content) return;

    addUserMessage(content);
    input.value = '';
    autoResize(input);

    try {
      setIsTyping(true);
      const body = {
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content }
        ]
      };

      const r = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      let text = 'Je n’ai pas pu répondre pour le moment.';
      if (r.ok) {
        const j = await r.json();
        if (j?.ok && j?.text) text = j.text;
        else if (j?.text) text = j.text;
      } else {
        text = `Erreur API (${r.status})`;
      }

      addAIMessage(text);
    } catch (e: any) {
      addAIMessage("⚠️ Erreur réseau lors de l'appel à l'API.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setTimeout(() => {
      addAIMessage(`📁 Super ! J'ai détecté le fichier "${f.name}". Je vais l'analyser pour identifier les problèmes de qualité. Que souhaitez-vous savoir sur vos données ?`);
    }, 600);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#fff' }}>
      <style>{css}</style>

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">📊</div>
            <div>
              <div className="logo-text">DataClean AI</div>
              <div className="logo-subtitle">Assistant IA pour nettoyage de données d'entreprise</div>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="lang-toggle"
              onClick={() => setLang((l) => (l === 'FR' ? 'EN' : 'FR'))}
              title="Changer la langue"
            >
              🌐 {lang}
            </button>
            <a href="#" className="pro-badge">👑 Pro</a>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="nav-container">
        <nav className="nav-tabs">
          <button className={`nav-tab ${activeTab === 'analyze' ? 'active' : ''}`} onClick={() => handleShowTab('analyze')}>📊 <strong>Analyser</strong></button>
          <button className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => handleShowTab('stats')}>📈 <strong>Statistiques descriptives</strong></button>
          <button className={`nav-tab ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => handleShowTab('schedule')}>📅 <strong>Planifier</strong></button>
          <button className={`nav-tab ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => handleShowTab('jobs')}>⚙️ <strong>Jobs</strong></button>
        </nav>
      </div>

      {/* Main */}
      <div className="main-container">
        {/* Content */}
        <main className="content">
          {/* ANALYZE */}
          <div className={`tab-content ${activeTab === 'analyze' ? 'active' : ''}`}>
            <div className="upload-area" onClick={onPickFile}>
              <div className="upload-icon">📤</div>
              <h2 className="upload-title">Déposez vos fichiers ou cliquez ici</h2>
              <p className="upload-subtitle">CSV, Excel, JSON, TXT</p>

              <div className="upload-features">
                <div className="feature">
                  <div className="feature-dot dot-green"></div><span>Taille max: 50 Mo</span>
                </div>
                <div className="feature">
                  <div className="feature-dot dot-blue"></div><span>Analyse gratuite - 1000 lignes</span>
                </div>
                <div className="feature">
                  <div className="feature-dot dot-purple"></div><span>Traitement local sécurisé</span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                id="fileInput"
                type="file"
                accept=".csv,.xlsx,.json,.txt"
                multiple
                onChange={onFileChange}
              />
            </div>
          </div>

          {/* STATS */}
          <div className={`tab-content ${activeTab === 'stats' ? 'active' : ''}`}>
            <h2>📈 Statistiques Descriptives</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '1rem' }}>
              Résumés statistiques et graphiques après nettoyage des données. Cette section affichera :
            </p>
            <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem', color: 'rgba(255,255,255,0.8)' }}>
              <li style={{ marginBottom: '.5rem' }}>Statistiques descriptives par colonne</li>
              <li style={{ marginBottom: '.5rem' }}>Graphiques de distribution</li>
              <li style={{ marginBottom: '.5rem' }}>Comparaisons avant/après nettoyage</li>
              <li style={{ marginBottom: '.5rem' }}>Métriques de qualité des données</li>
            </ul>
          </div>

          {/* SCHEDULE */}
          <div className={`tab-content ${activeTab === 'schedule' ? 'active' : ''}`}>
            <h2>📅 Planifier</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '1rem' }}>
              Création et gestion de jobs planifiés pour le nettoyage automatique :
            </p>
            <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem', color: 'rgba(255,255,255,0.8)' }}>
              <li style={{ marginBottom: '.5rem' }}>Planification récurrente (quotidien, hebdomadaire, mensuel)</li>
              <li style={{ marginBottom: '.5rem' }}>Configuration des sources de données</li>
              <li style={{ marginBottom: '.5rem' }}>Règles de nettoyage personnalisées</li>
              <li style={{ marginBottom: '.5rem' }}>Notifications et alertes</li>
            </ul>
          </div>

          {/* JOBS */}
          <div className={`tab-content ${activeTab === 'jobs' ? 'active' : ''}`}>
            <h2>⚙️ Jobs</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '1rem' }}>
              Suivi des exécutions, statuts et téléchargements :
            </p>
            <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem', color: 'rgba(255,255,255,0.8)' }}>
              <li style={{ marginBottom: '.5rem' }}>État en temps réel des jobs (running, completed, failed)</li>
              <li style={{ marginBottom: '.5rem' }}>Historique complet des exécutions</li>
              <li style={{ marginBottom: '.5rem' }}>Téléchargement des résultats nettoyés</li>
              <li style={{ marginBottom: '.5rem' }}>Logs détaillés et métriques de performance</li>
            </ul>
          </div>
        </main>

        {/* Sidebar Chat */}
        <aside className="sidebar">
          <div className="chat-header">
            <div className="assistant-icon">🤖</div>
            <div className="assistant-info">
              <h3>Assistant IA</h3>
              <p>Expert en nettoyage de données</p>
            </div>
          </div>

          <div className="chat-messages" id="chatMessages">
            {/* Messages */}
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.role === 'user' ? 'user' : ''}`}>
                <div className={`message-avatar ${m.role === 'user' ? 'avatar-user' : 'avatar-ai'}`}>
                  {m.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">{m.content}</div>
              </div>
            ))}

            {/* Questions suggérées */}
            <div className="suggested-questions">
              {suggested.map((q) => (
                <button key={q} className="suggested-question" onClick={() => askQuestion(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="chat-input-container">
            <div
              className="typing-indicator"
              id="typingIndicator"
              style={{ display: isTyping ? 'flex' : 'none' }}
            >
              L&apos;IA réfléchit
              <div className="typing-dots">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>

            <div className="chat-input-wrapper">
              <textarea
                className="chat-input"
                id="chatInput"
                placeholder="Posez votre question sur vos données..."
                rows={1}
                onKeyDown={handleEnterKey}
                onInput={(e) => autoResize(e.currentTarget)}
              />
              <button className="send-button" onClick={sendMessage} disabled={isTyping} id="sendButton">
                ➤
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

const css = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #ffffff; min-height: 100vh; }
.header { background: #1a1a2e; padding: 1rem 2rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.header-content { display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto; }
.logo { display: flex; align-items: center; gap: 0.75rem; font-size: 1.25rem; font-weight: 600; color: white; }
.logo-icon { width: 36px; height: 36px; background: #4a90e2; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; }
.logo-text { color: white; }
.logo-subtitle { font-size: 0.8rem; color: rgba(255, 255, 255, 0.6); font-weight: 400; margin-top: 2px; }
.header-actions { display: flex; align-items: center; gap: 1rem; }
.lang-toggle { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem; }
.pro-badge { background: #ff8c00; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 600; text-decoration: none; color: white; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem; }

.nav-container { background: #1a1a2e; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 0 2rem; }
.nav-tabs { display: flex; gap: 0; max-width: 1400px; margin: 0 auto; }
.nav-tab { padding: 1rem 1.5rem; border: none; background: transparent; color: rgba(255, 255, 255, 0.7); cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; position: relative; border-bottom: 3px solid transparent; font-size: 0.9rem; transition: all 0.2s ease; }
.nav-tab.active { color: #4a90e2; border-bottom-color: #4a90e2; background: rgba(74, 144, 226, 0.05); }
.nav-tab:hover:not(.active) { color: rgba(255, 255, 255, 0.9); background: rgba(255, 255, 255, 0.03); }

.main-container { max-width: 1400px; margin: 0 auto; padding: 2rem; display: flex; gap: 2rem; }
.content { flex: 1; background: rgba(255, 255, 255, 0.03); border-radius: 16px; padding: 2rem; border: 1px solid rgba(255, 255, 255, 0.1); position: relative; }

.sidebar { width: 320px; background: rgba(255, 255, 255, 0.03); border-radius: 16px; padding: 0; border: 1px solid rgba(255, 255, 255, 0.1); height: 600px; display: flex; flex-direction: column; }
.chat-header { display: flex; align-items: center; gap: 0.75rem; padding: 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.assistant-icon { width: 32px; height: 32px; background: linear-gradient(135deg, #8b5cf6, #a855f7); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1rem; }
.assistant-info h3 { font-size: 1rem; font-weight: 600; margin-bottom: 2px; }
.assistant-info p { font-size: 0.8rem; color: rgba(255, 255, 255, 0.6); }

.chat-messages { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
.message { display: flex; gap: 0.75rem; animation: messageSlide 0.3s ease-out; }
.message.user { flex-direction: row-reverse; }
.message-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; flex-shrink: 0; }
.avatar-ai { background: linear-gradient(135deg, #8b5cf6, #a855f7); color: white; }
.avatar-user { background: #4a90e2; color: white; }
.message-content { background: rgba(255, 255, 255, 0.05); padding: 0.75rem 1rem; border-radius: 12px; max-width: 220px; font-size: 0.85rem; line-height: 1.4; }
.message.user .message-content { background: #4a90e2; color: white; }

.chat-input-container { padding: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.1); }
.chat-input-wrapper { display: flex; gap: 0.5rem; align-items: flex-end; }
.chat-input { flex: 1; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px; padding: 0.75rem 1rem; color: white; font-size: 0.85rem; resize: none; min-height: 40px; max-height: 100px; font-family: inherit; }
.chat-input::placeholder { color: rgba(255, 255, 255, 0.5); }
.chat-input:focus { outline: none; border-color: #4a90e2; background: rgba(255, 255, 255, 0.08); }
.send-button { width: 40px; height: 40px; background: #4a90e2; border: none; border-radius: 50%; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: all 0.2s ease; }
.send-button:hover { background: #357abd; transform: scale(1.05); }
.send-button:disabled { background: rgba(255, 255, 255, 0.2); cursor: not-allowed; transform: none; }

.typing-indicator { display: flex; align-items: center; gap: 0.5rem; color: rgba(255, 255, 255, 0.6); font-size: 0.8rem; padding: 0.5rem 0; }
.typing-dots { display: flex; gap: 2px; }
.typing-dot { width: 4px; height: 4px; background: #8b5cf6; border-radius: 50%; animation: typingDot 1.4s infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingDot { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }
@keyframes messageSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.upload-area { border: 2px dashed rgba(255, 255, 255, 0.3); border-radius: 12px; padding: 4rem 2rem; text-align: center; background: rgba(255, 255, 255, 0.02); cursor: pointer; transition: all 0.2s ease; }
.upload-area:hover { border-color: #4a90e2; background: rgba(74, 144, 226, 0.05); }
.upload-icon { width: 64px; height: 64px; background: #4a90e2; border-radius: 12px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: white; }
.upload-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
.upload-subtitle { font-size: 0.9rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 1.5rem; }
.upload-features { display: flex; justify-content: center; gap: 2rem; font-size: 0.85rem; }
.feature { display: flex; align-items: center; gap: 0.5rem; color: rgba(255, 255, 255, 0.8); }
.feature-dot { width: 8px; height: 8px; border-radius: 50%; }
.dot-green { background: #4ade80; }
.dot-blue { background: #4a90e2; }
.dot-purple { background: #a855f7; }

.tab-content { display: none; }
.tab-content.active { display: block; }

#fileInput { display: none; }

@media (max-width: 1024px) {
  .main-container { flex-direction: column; }
  .sidebar { width: 100%; }
  .nav-tabs { flex-wrap: wrap; }
  .upload-features { flex-direction: column; gap: 1rem; }
}
@media (max-width: 768px) {
  .header-content { flex-direction: column; gap: 1rem; }
  .main-container { padding: 1rem; }
  .nav-container { padding: 0 1rem; }
}
`;
