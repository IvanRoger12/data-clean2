import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadFile } from './utils/fileLoader';
import { analyzeDataset } from './utils/analyze';
import { applyCorrection } from './utils/clean';
import { computeStats } from './utils/stats';
import { downloadCSV, downloadExcel, downloadPDFReport, downloadZIPAll } from './utils/export';
import { createJob, dryRunJob, exportICS, loadJobs, loadRuns, saveJobs, saveRuns } from './utils/schedule';
import { AnalysisResult, CorrectionSuggestion, Dataset, Job, JobRun } from './utils/types';
import Chart from 'chart.js/auto';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function App() {
  const [activeTab, setActiveTab] = useState<'analyze' | 'stats' | 'schedule' | 'jobs'>('analyze');
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Salut ! Je suis votre assistant IA spécialisé en nettoyage de données. Uploadez un fichier et je vous aiderai." }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [lang, setLang] = useState<'FR' | 'EN'>('FR');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // DATASET + ANALYSE/NETTOYAGE
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [progressStep, setProgressStep] = useState<string>('');
  const [pending, setPending] = useState<Record<string, CorrectionSuggestion[]>>({}); // par colonne

  // STATS
  const [statsChart1, setStatsChart1] = useState<Chart | null>(null);
  const [statsChart2, setStatsChart2] = useState<Chart | null>(null);

  // JOBS
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runs, setRuns] = useState<JobRun[]>([]);

  useEffect(() => {
    setJobs(loadJobs());
    setRuns(loadRuns());
  }, []);

  // ===== Chat (déjà OK) =====
  const suggested = useMemo(
    () => [
      'Comment nettoyer cette colonne ?',
      'Quels sont les doublons détectés ?',
      'Recommande-moi des règles de validation',
      'Explique-moi ces anomalies'
    ],
    []
  );
  const addUserMessage = (content: string) => setMessages(m => [...m, { role: 'user', content }]);
  const addAIMessage = (content: string) => setMessages(m => [...m, { role: 'assistant', content }]);
  const askQuestion = (q: string) => { (document.getElementById('chatInput') as HTMLTextAreaElement).value = q; sendMessage(); };
  const sendMessage = async () => {
    if (isTyping) return;
    const input = document.getElementById('chatInput') as HTMLTextAreaElement;
    const content = (input.value || '').trim();
    if (!content) return;
    addUserMessage(content); input.value=''; autoResize(input);
    try {
      setIsTyping(true);
      const body = { messages: [...messages, { role: 'user', content }] };
      const r = await fetch('/api/openai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      let text = 'Je n’ai pas pu répondre.';
      if (r.ok) { const j = await r.json(); text = j?.text || text; } else { text = `Erreur API (${r.status})`; }
      addAIMessage(text);
    } catch { addAIMessage("⚠️ Erreur réseau lors de l'appel à l'API."); }
    finally { setIsTyping(false); }
  };
  const handleEnterKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  // ===== Upload & Analyse =====
  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setProgressStep('Lecture du fichier…');
      const ds = await loadFile(f);
      setDataset(ds);
      setProgressStep('Analyse de la structure…');
      await sleep(300);
      setProgressStep('Détection des anomalies…');
      await sleep(300);
      const an = analyzeDataset(ds);
      setAnalysis(an);
      setProgressStep('');
      addAIMessage(`📁 Fichier "${ds.workbookName}" détecté (feuille: ${ds.sheetName}). ${ds.rows.length} lignes, ${ds.columns.length} colonnes. Je propose des corrections pour les colonnes en erreur.`);
      // init pending corrections (par défaut: rien de sélectionné)
      const init: Record<string, CorrectionSuggestion[]> = {};
      an.issues.forEach(i => init[i.name] = i.suggestions.map(s => ({...s, selected:false})));
      setPending(init);
    } catch (err: any) {
      addAIMessage(`❌ Erreur de lecture: ${err?.message || 'inconnue'}`);
      setProgressStep('');
    }
  };

  // Appliquer une correction sur une colonne
  const toggleSuggestion = (col: string, sid: string) => {
    setPending(prev => {
      const arr = prev[col]?.map(s => s.id === sid ? { ...s, selected: !s.selected } : s) || [];
      return { ...prev, [col]: arr };
    });
  };
  const applyColumnCorrections = (col: string) => {
    if (!dataset) return;
    const selected = (pending[col] || []).filter(s => s.selected);
    if (selected.length === 0) return;
    let ds = { ...dataset };
    selected.forEach(s => { ds = applyCorrection(ds, col, s.apply, s.args); });
    setDataset(ds);
    const an = analyzeDataset(ds);
    setAnalysis(an);
    addAIMessage(`✅ Corrections appliquées sur "${col}". Score global: ${an.globalScore}%`);
  };
  const applyAllCorrections = () => {
    if (!dataset || !analysis) return;
    let ds = { ...dataset };
    analysis.issues.forEach(i => {
      (pending[i.name] || []).filter(s => s.selected).forEach(s => {
        ds = applyCorrection(ds, i.name, s.apply, s.args);
      });
    });
    setDataset(ds);
    const an = analyzeDataset(ds);
    setAnalysis(an);
    addAIMessage(`🏁 Toutes les corrections sélectionnées ont été appliquées. Nouveau score: ${an.globalScore}%`);
  };

  // ===== Export =====
  const onDownloadCSV = () => dataset && downloadCSV(dataset);
  const onDownloadExcel = () => dataset && downloadExcel(dataset);
  const onDownloadPDF = () => analysis && downloadPDFReport({ score: analysis.globalScore, kpis: analysis.kpis, insights: analysis.insights });
  const onDownloadAll = () => dataset && analysis && downloadZIPAll(dataset, { score: analysis.globalScore, kpis: analysis.kpis, insights: analysis.insights });

  // ===== Stats (charts) =====
  useEffect(() => {
    if (!analysis || !dataset) return;
    const { issues } = analysis;

    const ctx1 = (document.getElementById('chart1') as HTMLCanvasElement | null)?.getContext('2d') || null;
    const ctx2 = (document.getElementById('chart2') as HTMLCanvasElement | null)?.getContext('2d') || null;

    if (ctx1) {
      statsChart1?.destroy();
      const c = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: issues.map(i => i.name),
          datasets: [{ label: '% Manquants', data: issues.map(i => i.missingPct) }]
        }
      });
      setStatsChart1(c);
    }
    if (ctx2) {
      statsChart2?.destroy();
      const c2 = new Chart(ctx2, {
        type: 'pie',
        data: {
          labels: ['Doublons', 'Invalides', 'Outliers'],
          datasets: [{ data: [
            Math.round(issues.reduce((a,i)=>a+i.duplicatePct,0)/Math.max(1,issues.length)),
            Math.round(issues.reduce((a,i)=>a+i.invalidPct,0)/Math.max(1,issues.length)),
            Math.round(issues.reduce((a,i)=>a+i.outlierPct,0)/Math.max(1,issues.length)),
          ] }]
        }
      });
      setStatsChart2(c2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, dataset]);

  // ===== Jobs / Schedule =====
  const [newJob, setNewJob] = useState<{name:string; frequency:Job['frequency']; time:string; source:Job['source']; url?:string}>({
    name: 'Analyse CRM quotidienne', frequency: 'daily', time: '09:00', source: 'current'
  });
  const createNewJob = () => {
    const j = createJob({ name:newJob.name, frequency:newJob.frequency, time:newJob.time, source:newJob.source, url:newJob.url });
    setJobs(loadJobs());
    const ics = exportICS(j);
    triggerDownload(ics, `${j.name.replace(/\s+/g,'_')}.ics`, 'text/calendar');
  };
  const runDry = (job: Job) => {
    dryRunJob(job);
    setRuns(loadRuns());
    setTimeout(()=> setRuns(loadRuns()), 1000);
  };
  const deleteJob = (id: string) => {
    const list = loadJobs().filter(j => j.id !== id);
    saveJobs(list); setJobs(list);
  };

  // ===== UI =====
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
            <button className="lang-toggle" onClick={()=>setLang(l=>l==='FR'?'EN':'FR')}>🌐 {lang}</button>
            <a href="#" className="pro-badge">👑 Pro</a>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="nav-container">
        <nav className="nav-tabs">
          <button className={`nav-tab ${activeTab==='analyze'?'active':''}`} onClick={()=>setActiveTab('analyze')}>📊 <strong>Analyser</strong></button>
          <button className={`nav-tab ${activeTab==='stats'?'active':''}`} onClick={()=>setActiveTab('stats')}>📈 <strong>Statistiques descriptives</strong></button>
          <button className={`nav-tab ${activeTab==='schedule'?'active':''}`} onClick={()=>setActiveTab('schedule')}>📅 <strong>Planifier</strong></button>
          <button className={`nav-tab ${activeTab==='jobs'?'active':''}`} onClick={()=>setActiveTab('jobs')}>⚙️ <strong>Jobs</strong></button>
        </nav>
      </div>

      {/* Main */}
      <div className="main-container">
        {/* Content */}
        <main className="content">
          {/* ANALYZE */}
          <div className={`tab-content ${activeTab === 'analyze' ? 'active' : ''}`}>
            {!dataset && (
              <div className="upload-area" onClick={onPickFile}>
                <div className="upload-icon">📤</div>
                <h2 className="upload-title">Déposez vos fichiers ou cliquez ici</h2>
                <p className="upload-subtitle">CSV, Excel, JSON, TXT</p>
                <div className="upload-features">
                  <div className="feature"><div className="feature-dot dot-green"></div><span>Taille max: 50 Mo</span></div>
                  <div className="feature"><div className="feature-dot dot-blue"></div><span>Analyse gratuite - 1000 lignes</span></div>
                  <div className="feature"><div className="feature-dot dot-purple"></div><span>Traitement local sécurisé</span></div>
                </div>
                <input ref={fileInputRef} id="fileInput" type="file" accept=".csv,.xlsx,.json,.txt" multiple onChange={onFileChange}/>
              </div>
            )}

            {progressStep && (
              <div style={{ marginTop:'1rem', padding:'1rem', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, background:'rgba(255,255,255,0.03)' }}>
                <b>Analyse en cours…</b> <span style={{opacity:.8}}>{progressStep}</span>
                <div style={{marginTop:8, height:6, background:'rgba(255,255,255,0.1)', borderRadius:6}}>
                  <div style={{width:'65%', height:'100%', background:'#4a90e2', borderRadius:6}} />
                </div>
              </div>
            )}

            {dataset && analysis && (
              <div style={{ display:'grid', gap:'16px', marginTop:'16px' }}>
                {/* Preview (1ère ligne/colonne visibles + pagination simple) */}
                <section style={{border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:16}}>
                  <h3 style={{marginBottom:8}}>🔎 Aperçu (1000 premières lignes)</h3>
                  <small style={{opacity:.7}}>Feuille: <b>{dataset.sheetName}</b> • Colonnes: {dataset.columns.length} • Lignes: {dataset.rows.length}</small>
                  <div style={{overflow:'auto', marginTop:8}}>
                    <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
                      <thead>
                        <tr>
                          {dataset.columns.map(c => (
                            <th key={c} style={{textAlign:'left', padding:'8px', borderBottom:'1px solid rgba(255,255,255,0.1)'}}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dataset.sampleRows.slice(0, 20).map((r, i) => (
                          <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                            {dataset.columns.map(c => (
                              <td key={c} style={{padding:'6px 8px', whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden', maxWidth:200}}>
                                {String(r[c] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Score & KPIs */}
                <section style={{display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))'}}>
                  <div style={card}>
                    <div style={{fontSize:12, opacity:.7}}>Score Qualité Global</div>
                    <div style={{fontSize:28, fontWeight:700, color: scoreColor(analysis.globalScore)}}>{analysis.globalScore}%</div>
                  </div>
                  <div style={card}><div style={{fontSize:12, opacity:.7}}>Doublons</div><div style={kpi}>{analysis.kpis.duplicates}%</div></div>
                  <div style={card}><div style={{fontSize:12, opacity:.7}}>Anomalies</div><div style={kpi}>{analysis.kpis.anomalies}</div></div>
                  <div style={card}><div style={{fontSize:12, opacity:.7}}>Lignes</div><div style={kpi}>{analysis.kpis.lines}</div></div>
                  <div style={card}><div style={{fontSize:12, opacity:.7}}>Colonnes</div><div style={kpi}>{analysis.kpis.columns}</div></div>
                </section>

                {/* Insights IA (générés côté analyse) */}
                <section style={card}>
                  <h3>💡 Insights</h3>
                  <ul style={{marginTop:8, paddingLeft:18}}>
                    {analysis.insights.map((i,idx)=><li key={idx} style={{marginBottom:6}}>{i}</li>)}
                  </ul>
                </section>

                {/* Colonnes en erreur + Corrections */}
                <section style={card}>
                  <h3>🧹 Nettoyage par colonnes</h3>
                  <p style={{opacity:.75, margin:'6px 0 12px'}}>Seules les colonnes avec problèmes s’affichent. Cochez les actions à appliquer puis “Appliquer”.</p>
                  <div style={{display:'grid', gap:12}}>
                    {analysis.issues.map(issue => (
                      <div key={issue.name} style={{border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:12}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                          <div>
                            <b>{issue.name}</b> <span style={{opacity:.6, fontSize:12, marginLeft:6}}>({issue.type})</span>
                            <div style={{fontSize:12, opacity:.75, marginTop:4}}>
                              Manquants: <b>{issue.missingPct}%</b> • Doublons: <b>{issue.duplicatePct}%</b> • Invalides: <b>{issue.invalidPct}%</b> • Outliers: <b>{issue.outlierPct}%</b> • Score: <b>{issue.score}%</b>
                            </div>
                          </div>
                          <button onClick={()=>applyColumnCorrections(issue.name)} className="btnPrimary">Appliquer</button>
                        </div>
                        <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                          {(pending[issue.name] || []).map(s => (
                            <label key={s.id} style={pill(s.selected)}>
                              <input type="checkbox" checked={!!s.selected} onChange={()=>toggleSuggestion(issue.name, s.id)} />
                              <span style={{marginLeft:6}}>{s.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{marginTop:12, display:'flex', gap:8}}>
                    <button onClick={applyAllCorrections} className="btnPrimary">✅ Valider toutes les corrections sélectionnées</button>
                  </div>
                </section>

                {/* Exports */}
                <section style={card}>
                  <h3>📥 Export</h3>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
                    <button onClick={onDownloadCSV} className="btn">CSV Nettoyé</button>
                    <button onClick={onDownloadExcel} className="btn">Excel Nettoyé</button>
                    <button onClick={onDownloadPDF} className="btn">Rapport PDF</button>
                    <button onClick={onDownloadAll} className="btn">Télécharger Tout</button>
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* STATS */}
          <div className={`tab-content ${activeTab === 'stats' ? 'active' : ''}`}>
            <h2>📈 Statistiques Descriptives</h2>
            {!dataset || !analysis ? (
              <p style={{opacity:.8, marginTop:12}}>Uploadez et nettoyez un fichier dans l’onglet “Analyser” pour voir les graphes ici.</p>
            ) : (
              <div style={{display:'grid', gap:16, marginTop:12}}>
                <div style={card}><h4 style={{marginBottom:8}}>Manquants par colonne</h4><canvas id="chart1" height={120}></canvas></div>
                <div style={card}><h4 style={{marginBottom:8}}>Répartition des problèmes</h4><canvas id="chart2" height={120}></canvas></div>
              </div>
            )}
          </div>

          {/* SCHEDULE */}
          <div className={`tab-content ${activeTab === 'schedule' ? 'active' : ''}`}>
            <h2>📅 Planifier</h2>
            <div style={card}>
              <div style={{display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
                <div>
                  <div className="label">Nom du job</div>
                  <input className="input" value={newJob.name} onChange={e=>setNewJob({...newJob, name:e.target.value})}/>
                </div>
                <div>
                  <div className="label">Fréquence</div>
                  <select className="input" value={newJob.frequency} onChange={e=>setNewJob({...newJob, frequency:e.target.value as any})}>
                    <option value="daily">Quotidien</option><option value="weekly">Hebdomadaire</option><option value="monthly">Mensuel</option><option value="cron">Cron simple</option>
                  </select>
                </div>
                <div>
                  <div className="label">Heure</div>
                  <input className="input" type="time" value={newJob.time} onChange={e=>setNewJob({...newJob, time:e.target.value})}/>
                </div>
                <div>
                  <div className="label">Source</div>
                  <select className="input" value={newJob.source} onChange={e=>setNewJob({...newJob, source:e.target.value as any})}>
                    <option value="current">Fichier courant</option>
                    <option value="demo">Données démo</option>
                    <option value="url">URL publique CSV/JSON</option>
                  </select>
                </div>
                {newJob.source==='url' && (
                  <div style={{gridColumn:'1 / -1'}}>
                    <div className="label">URL</div>
                    <input className="input" placeholder="https://exemple.com/data.csv" value={newJob.url||''} onChange={e=>setNewJob({...newJob, url:e.target.value})}/>
                  </div>
                )}
              </div>
              <div style={{marginTop:12, display:'flex', gap:8}}>
                <button onClick={createNewJob} className="btnPrimary">Créer (+ .ICS)</button>
              </div>
            </div>

            <div style={{marginTop:16}}>
              <h3>Jobs Planifiés</h3>
              {jobs.length===0 ? <p style={{opacity:.8, marginTop:8}}>Aucun job pour le moment.</p> : (
                <div style={{display:'grid', gap:12, marginTop:8}}>
                  {jobs.map(j => (
                    <div key={j.id} style={cardRow}>
                      <div>
                        <div><b>{j.name}</b> <span style={{opacity:.7, fontSize:12}}>({j.frequency} @ {j.time})</span></div>
                        <div style={{opacity:.7, fontSize:12}}>Prochaine exécution: {new Date(j.nextRunISO).toLocaleString()}</div>
                      </div>
                      <div style={{display:'flex', gap:8}}>
                        <button className="btn" onClick={()=>runDry(j)}>Dry-Run</button>
                        <button className="btn" onClick={()=>{ const ics = exportICS(j); triggerDownload(ics, `${j.name.replace(/\s+/g,'_')}.ics`, 'text/calendar'); }}>Export .ICS</button>
                        <button className="btn danger" onClick={()=>deleteJob(j.id)}>Supprimer</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* JOBS */}
          <div className={`tab-content ${activeTab === 'jobs' ? 'active' : ''}`}>
            <h2>⚙️ Jobs</h2>
            {runs.length===0 ? <p style={{opacity:.8, marginTop:8}}>Pas encore d’exécutions. Lance un Dry-Run dans “Planifier”.</p> : (
              <div style={{marginTop:8}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
                  <thead>
                    <tr>
                      <th className="th">Job</th><th className="th">Statut</th><th className="th">Début</th><th className="th">Fin</th><th className="th">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(r=>(
                      <tr key={r.id} className="tr">
                        <td className="td">{jobs.find(j=>j.id===r.jobId)?.name || r.jobId}</td>
                        <td className="td">{r.status}</td>
                        <td className="td">{new Date(r.startedAt).toLocaleString()}</td>
                        <td className="td">{r.finishedAt? new Date(r.finishedAt).toLocaleString() : '-'}</td>
                        <td className="td">{r.resultNote || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar Chat (inchangé côté style, connecté à /api/openai) */}
        <aside className="sidebar">
          <div className="chat-header">
            <div className="assistant-icon">🤖</div>
            <div className="assistant-info">
              <h3>Assistant IA</h3>
              <p>Expert en nettoyage de données</p>
            </div>
          </div>

          <div className="chat-messages" id="chatMessages">
            {messages.map((m,i)=>(
              <div key={i} className={`message ${m.role==='user'?'user':''}`}>
                <div className={`message-avatar ${m.role==='user'?'avatar-user':'avatar-ai'}`}>{m.role==='user'?'👤':'🤖'}</div>
                <div className="message-content">{m.content}</div>
              </div>
            ))}
            <div className="suggested-questions">
              {suggested.map(q => <button key={q} className="suggested-question" onClick={()=>askQuestion(q)}>{q}</button>)}
            </div>
          </div>

          <div className="chat-input-container">
            <div className="typing-indicator" style={{display: isTyping?'flex':'none'}}>
              L'IA réfléchit
              <div className="typing-dots"><div className="typing-dot"></div><div className="typing-dot"></div><div className="typing-dot"></div></div>
            </div>
            <div className="chat-input-wrapper">
              <textarea className="chat-input" id="chatInput" placeholder="Posez votre question sur vos données..." rows={1} onKeyDown={handleEnterKey} onInput={e=>autoResize(e.currentTarget)} />
              <button className="send-button" onClick={sendMessage} disabled={isTyping}>➤</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ===== helpers & styles =====
function autoResize(el: HTMLTextAreaElement) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,100)+'px'; }
function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }
function scoreColor(s:number){ if (s>=90) return '#4ade80'; if (s>=70) return '#facc15'; return '#f87171'; }
function triggerDownload(data: string, filename: string, mime?: string) {
  const blob = new Blob([data], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
}
const card: React.CSSProperties = { border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:16, background:'rgba(255,255,255,0.03)' };
const kpi: React.CSSProperties = { fontSize:22, fontWeight:700, marginTop:4 };
const cardRow: React.CSSProperties = { ...card, display:'flex', justifyContent:'space-between', alignItems:'center' };
const pill = (sel?:boolean): React.CSSProperties => ({
  display:'inline-flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:999, border:`1px solid ${sel?'#4a90e2':'rgba(255,255,255,0.15)'}`, background: sel?'rgba(74,144,226,0.15)':'rgba(255,255,255,0.05)', cursor:'pointer', fontSize:12
});

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
.typing-dot:nth-child(2) { animation-delay: 0.2s; } .typing-dot:nth-child(3) { animation-delay: 0.4s; }
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
.dot-green { background: #4ade80; } .dot-blue { background: #4a90e2; } .dot-purple { background: #a855f7; }
.tab-content { display: none; } .tab-content.active { display: block; }
#fileInput { display: none; }
.btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); padding: 8px 12px; border-radius: 8px; color: #fff; cursor: pointer; }
.btn:hover { background: rgba(255,255,255,0.12); }
.btnPrimary { background: #4a90e2; border: none; padding: 8px 12px; border-radius: 8px; color: #fff; cursor: pointer; }
.btnPrimary:hover { background: #357abd; }
.btn.danger { border-color: rgba(255, 99, 99, .4); color: #ff8181; }
.th, .td { text-align:left; padding:8px; border-bottom:1px solid rgba(255,255,255,0.08); }
`;
