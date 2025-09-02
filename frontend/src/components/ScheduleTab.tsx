import React, { useState } from 'react'
import { Dataset, JobItem } from '../lib/utils'
import { makeICS, saveJobs } from '../lib/schedule'

type Props = { dataset: Dataset|null, jobs: JobItem[], setJobs: (j:JobItem[])=>void }

export default function ScheduleTab({ dataset, jobs, setJobs }: Props) {
  const [form, setForm] = useState({ name:'Analyse CRM quotidienne', frequency:'daily', time:'09:00', source:'current' })

  function createJob() {
    const job: JobItem = {
      id: 'job_'+Date.now(),
      name: form.name,
      frequency: form.frequency as any,
      time: form.time,
      source: form.source,
      status: 'pending',
      lastRun: null,
      nextRun: null
    }
    const updated = [job, ...jobs]
    setJobs(updated); saveJobs(updated)
  }

  function dryRun(job: JobItem) {
    const updated = jobs.map(j => j.id===job.id ? { ...j, status:'completed', lastRun: new Date().toISOString() } : j)
    setJobs(updated); saveJobs(updated)
    alert(`Dry-run terminé pour ${job.name}. (Simulation)` )
  }

  function exportICS(job: JobItem) {
    const ics = makeICS(job)
    const blob = new Blob([ics], {type:'text/calendar'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${job.name.replace(/\s+/g,'_')}.ics`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <h2>📅 Planifier</h2>
      <p style={{opacity:.7, marginTop:6}}>Créez des jobs planifiés (localStorage). Export .ICS pour votre calendrier.</p>

      <div style={{marginTop:16, border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:12}}>
        <h3 style={{marginBottom:8}}>Nouveau job</h3>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <input className="chat-input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
          <select className="chat-input" value={form.frequency} onChange={e=>setForm({...form, frequency:e.target.value})}>
            <option value="daily">Quotidien</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuel</option>
          </select>
          <input className="chat-input" type="time" value={form.time} onChange={e=>setForm({...form, time:e.target.value})} />
          <select className="chat-input" value={form.source} onChange={e=>setForm({...form, source:e.target.value})}>
            <option value="current">Fichier courant</option>
            <option value="demo">Données démo</option>
            <option value="url">URL publique CSV/JSON</option>
            <option value="api" disabled>API (Pro requis)</option>
            <option value="db" disabled>Base de données (Pro requis)</option>
          </select>
        </div>
        <div style={{display:'flex', gap:8, marginTop:12}}>
          <button className="btn primary" onClick={createJob}>Créer</button>
          <span className="badge">👑 Fonctions Pro : exécution 24/7, alertes email</span>
        </div>
      </div>

      <div style={{marginTop:16}}>
        <h3>Jobs planifiés</h3>
        {jobs.length===0 && (
          <div className="badge" style={{marginTop:8}}>Aucun job</div>
        )}
        <div style={{marginTop:8, display:'grid', gap:8}}>
          {jobs.map(j => (
            <div key={j.id} style={{border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <strong>{j.name}</strong>
                <div style={{opacity:.8, fontSize:'.9rem'}}>{j.frequency} • {j.time} • source: {j.source}</div>
                <div style={{opacity:.6, fontSize:'.85rem'}}>last: {j.lastRun? new Date(j.lastRun).toLocaleString():'—'}</div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn" onClick={()=>dryRun(j)}>Dry-run</button>
                <button className="btn" onClick={()=>exportICS(j)}>.ICS</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
