import React, { useMemo, useState } from 'react'
import ChatSidebar from './components/ChatSidebar'
import UploadAnalyze from './components/UploadAnalyze'
import StatsTab from './components/StatsTab'
import ScheduleTab from './components/ScheduleTab'
import JobsTab from './components/JobsTab'
import { Dataset, JobItem } from './lib/utils'

export default function App() {
  const [active, setActive] = useState<'analyze'|'stats'|'schedule'|'jobs'>('analyze')
  const [dataset, setDataset] = useState<Dataset|null>(null)        // données courantes
  const [cleaned, setCleaned] = useState<Dataset|null>(null)        // après nettoyage
  const [jobs, setJobs] = useState<JobItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('jobs')||'[]') } catch { return [] }
  })

  const hasData = useMemo(() => Boolean(dataset?.rows?.length), [dataset])

  return (
    <>
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
            <button className="lang-toggle">🌐 FR</button>
            <a href="#" className="pro-badge">👑 Pro</a>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="nav-container">
        <nav className="nav-tabs">
          <button className={`nav-tab ${active==='analyze'?'active':''}`} onClick={() => setActive('analyze')}>📊 <strong>Analyser</strong></button>
          <button className={`nav-tab ${active==='stats'?'active':''}`} onClick={() => setActive('stats')} disabled={!hasData} title={!hasData ? 'Uploadez et nettoyez un fichier' : ''}>📈 <strong>Statistiques descriptives</strong></button>
          <button className={`nav-tab ${active==='schedule'?'active':''}`} onClick={() => setActive('schedule')}>📅 <strong>Planifier</strong></button>
          <button className={`nav-tab ${active==='jobs'?'active':''}`} onClick={() => setActive('jobs')}>⚙️ <strong>Jobs</strong></button>
        </nav>
      </div>

      {/* Main */}
      <div className="main-container">
        <main className="content">
          {active==='analyze' && (
            <UploadAnalyze
              dataset={dataset}
              setDataset={setDataset}
              cleaned={cleaned}
              setCleaned={setCleaned}
            />
          )}

          {active==='stats' && (
            <StatsTab dataset={cleaned || dataset} />
          )}

          {active==='schedule' && (
            <ScheduleTab dataset={cleaned || dataset} jobs={jobs} setJobs={setJobs} />
          )}

          {active==='jobs' && (
            <JobsTab jobs={jobs} setJobs={setJobs} />
          )}
        </main>

        {/* Sidebar Chat (identique à ta maquette, mais connecté à /api/openai) */}
        <ChatSidebar />
      </div>
    </>
  )
}
