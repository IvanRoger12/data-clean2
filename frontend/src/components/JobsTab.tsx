import React from 'react'
import { JobItem } from '../lib/utils'
import { saveJobs } from '../lib/schedule'

export default function JobsTab({ jobs, setJobs }:{ jobs: JobItem[], setJobs:(j:JobItem[])=>void }) {
  function refresh() {
    // démo : pas d’appel serveur, on conserve localStorage
    const updated = [...jobs]
    setJobs(updated)
  }
  function runTest() {
    const updated = jobs.map(j => ({...j, status: j.status==='running'?'completed':'running' }))
    setJobs(updated); saveJobs(updated)
  }
  return (
    <div>
      <h2>⚙️ Jobs</h2>
      <div style={{display:'flex', gap:8, marginTop:8}}>
        <button className="btn success" onClick={runTest}>Lancer Test</button>
        <button className="btn" onClick={refresh}>Actualiser</button>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12, marginTop:12}}>
        <div className="kpi"><h4>En cours</h4><div className="val">{jobs.filter(j=>j.status==='running').length}</div></div>
        <div className="kpi"><h4>Terminés</h4><div className="val">{jobs.filter(j=>j.status==='completed').length}</div></div>
        <div className="kpi"><h4>En attente</h4><div className="val">{jobs.filter(j=>j.status==='pending').length}</div></div>
        <div className="kpi"><h4>Échecs</h4><div className="val">{jobs.filter(j=>j.status==='failed').length}</div></div>
      </div>

      <div style={{marginTop:16, border:'1px solid rgba(255,255,255,.1)', borderRadius:12, overflow:'hidden'}}>
        <div style={{padding:12, borderBottom:'1px solid rgba(255,255,255,.1)'}}><strong>Historique des Jobs</strong></div>
        <div style={{overflowX:'auto'}}>
          <table className="table">
            <thead>
              <tr><th>Job</th><th>Statut</th><th>Dernière exécution</th></tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td>{j.name}</td>
                  <td>{j.status}</td>
                  <td>{j.lastRun ? new Date(j.lastRun).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="badge" style={{marginTop:8}}>
        Mode démo : pour des jobs serveur 24/7, activez la version Pro (cron backend).
      </div>
    </div>
  )
}
