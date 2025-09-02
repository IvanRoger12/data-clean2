import React, { useMemo, useRef, useState } from 'react'
import { parseFiles } from '../lib/parse'
import { buildProfile, ColumnIssue, DatasetProfile } from '../lib/profile'
import { applyCorrections, Correction, defaultProposal } from '../lib/clean'
import { downloadCSV, downloadXLSX, downloadZIPAll, downloadPDFReport } from '../lib/export'
import { Dataset, paginate, PreviewPage } from '../lib/utils'

type Props = {
  dataset: Dataset|null
  setDataset: (d: Dataset|null) => void
  cleaned: Dataset|null
  setCleaned: (d: Dataset|null) => void
}

export default function UploadAnalyze({ dataset, setDataset, cleaned, setCleaned }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<DatasetProfile|null>(null)
  const [issues, setIssues] = useState<ColumnIssue[]>([])
  const [proposals, setProposals] = useState<Record<string, Correction[]>>({})
  const [log, setLog] = useState<string[]>([])
  const [progress, setProgress] = useState<number>(0)
  const [page, setPage] = useState<number>(1)

  const dataToShow = cleaned || dataset

  const pages: PreviewPage[] = useMemo(() => {
    if (!dataToShow?.preview) return []
    return paginate(dataToShow.preview, 100) // 100 lignes par page, dans la limite 1000
  }, [dataToShow])

  const columns = useMemo(() => dataToShow?.columns || [], [dataToShow])

  async function handleFiles(files: FileList|null) {
    if (!files || !files.length) return
    setProgress(5)
    const parsed = await parseFiles(files, (p) => setProgress(p))
    setDataset(parsed)
    setCleaned(null)
    setLog([])
    setProgress(35)
    const p = buildProfile(parsed)
    setProfile(p)
    setProgress(55)
    const is = p.columns.filter(c => (c.missingPct>0 || c.invalidPct>0 || c.duplicatesPct>0 || (c.anomalyCount??0)>0))
    setIssues(is)
    const props: Record<string, Correction[]> = {}
    is.forEach(c => { props[c.name] = defaultProposal(c) })
    setProposals(props)
    setProgress(100)
    setTimeout(()=>setProgress(0), 600)
  }

  function toggleCorrection(col: string, corr: Correction) {
    const list = proposals[col] || []
    const idx = list.findIndex(x => x.type===corr.type)
    const updated = idx>=0 ? [...list.slice(0,idx), ...list.slice(idx+1)] : [...list, corr]
    setProposals(prev => ({ ...prev, [col]: updated }))
  }

  function clearAll() {
    setDataset(null); setCleaned(null); setProfile(null); setIssues([]); setProposals({}); setLog([]); setPage(1)
  }

  async function applyAll() {
    if (!dataset || !profile) return
    const { updated, journal, newProfile } = applyCorrections(dataset, profile, proposals)
    setCleaned(updated)
    setLog(journal)
    setProfile(newProfile)
    const newIssues = newProfile.columns.filter(c => (c.missingPct>0 || c.invalidPct>0 || c.duplicatesPct>0 || (c.anomalyCount??0)>0))
    setIssues(newIssues)
  }

  const score = profile?.globalScore ?? 0

  return (
    <div>
      {!dataset && (
        <div className="upload-area" onClick={() => inputRef.current?.click()}>
          <div className="upload-icon">📤</div>
          <h2 className="upload-title">Déposez vos fichiers ou cliquez ici</h2>
          <p className="upload-subtitle">CSV, Excel, JSON, TXT</p>
          <div className="upload-features">
            <div className="feature"><div className="feature-dot dot-green"></div><span>Taille max: 50 Mo</span></div>
            <div className="feature"><div className="feature-dot dot-blue"></div><span>Analyse gratuite - 1000 lignes</span></div>
            <div className="feature"><div className="feature-dot dot-purple"></div><span>Traitement local sécurisé</span></div>
          </div>
          <input ref={inputRef} type="file" id="fileInput" accept=".csv,.xlsx,.json,.txt" multiple onChange={(e)=>handleFiles(e.target.files)} />
        </div>
      )}

      {progress>0 && (
        <div style={{marginTop:16}}>
          <div className="progress"><div style={{ width: `${progress}%` }} /></div>
          <div style={{opacity:.7, fontSize:'.85rem', marginTop:6}}>Analyse en cours…</div>
        </div>
      )}

      {dataset && (
        <>
          {/* KPIs + Score global */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(5, minmax(0,1fr))', gap:12, marginBottom:16}}>
            <div className="kpi"><h4>Score global</h4><div className="val">{Math.round(score)}%</div></div>
            <div className="kpi"><h4>Colonnes</h4><div className="val">{columns.length}</div></div>
            <div className="kpi"><h4>Lignes (preview)</h4><div className="val">{dataset.preview.length.toLocaleString()}</div></div>
            <div className="kpi"><h4>Doublons (moy.)</h4><div className="val">{Math.round((profile?.columns.reduce((a,c)=>a+c.duplicatesPct,0)/(profile?.columns.length||1))||0)}%</div></div>
            <div className="kpi"><h4>Manquants (moy.)</h4><div className="val">{Math.round((profile?.columns.reduce((a,c)=>a+c.missingPct,0)/(profile?.columns.length||1))||0)}%</div></div>
          </div>

          {/* Preview table (1k rows max, pagination) */}
          <div style={{overflow:'auto', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, marginBottom:16}}>
            <table className="table">
              <thead>
                <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {pages[page-1]?.rows.map((r, idx) => (
                  <tr key={idx}>
                    {columns.map(c => <td key={c}>{String((r as any)[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages.length>1 && (
            <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:16}}>
              <span className="badge">Page {page}/{pages.length}</span>
              <button className="btn" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>←</button>
              <button className="btn" onClick={()=>setPage(p=>Math.min(pages.length,p+1))} disabled={page===pages.length}>→</button>
            </div>
          )}

          {/* Issues (seulement colonnes en erreur) + actions */}
          <div style={{marginTop:8, marginBottom:16}}>
            <h3 style={{marginBottom:8}}>Colonnes avec erreurs</h3>
            {issues.length===0 && <div className="badge">Aucune erreur détectée 🎉</div>}
            {issues.map(col => (
              <div key={col.name} className="issue">
                <div style={{display:'flex', justifyContent:'space-between', gap:8}}>
                  <strong>{col.name}</strong>
                  <span className="badge">score {Math.round(col.score)}%</span>
                </div>
                <div style={{opacity:.9, fontSize:'.9rem', marginTop:6}}>
                  {col.missingPct>0 && <span>• {Math.round(col.missingPct)}% manquants&nbsp;&nbsp;</span>}
                  {col.invalidPct>0 && <span>• {Math.round(col.invalidPct)}% invalides&nbsp;&nbsp;</span>}
                  {col.duplicatesPct>0 && <span>• {Math.round(col.duplicatesPct)}% doublons&nbsp;&nbsp;</span>}
                  {col.anomalyCount>0 && <span>• {col.anomalyCount} anomalies</span>}
                </div>
                <div className="actions">
                  {(proposals[col.name]||[]).map(c => (
                    <button
                      key={c.type}
                      className={`btn ${c.selected ? 'primary' : ''}`}
                      onClick={()=>toggleCorrection(col.name, {...c, selected: !c.selected})}
                    >
                      {c.selected ? '✅ ' : ''}{c.label}
                    </button>
                  ))}
                  <button className="btn" onClick={()=>setProposals(prev => ({...prev, [col.name]: []}))}>Ignorer</button>
                </div>
              </div>
            ))}
          </div>

          {/* Actions globales */}
          <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:12}}>
            <button className="btn primary" onClick={applyAll}>Appliquer les corrections</button>
            <button className="btn" onClick={()=>downloadCSV(cleaned||dataset)}>Exporter CSV</button>
            <button className="btn" onClick={()=>downloadXLSX(cleaned||dataset)}>Exporter Excel</button>
            <button className="btn" onClick={()=>downloadPDFReport(profile!, cleaned||dataset)}>Rapport PDF</button>
            <button className="btn success" onClick={()=>downloadZIPAll(profile!, cleaned||dataset)}>Télécharger tout (ZIP)</button>
            <button className="btn" onClick={clearAll}>Nouveau fichier</button>
            <span className="badge">🔒 Vos données restent dans votre navigateur</span>
          </div>

          {/* Journal */}
          {log.length>0 && (
            <div style={{border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:12}}>
              <h3 style={{marginBottom:8}}>Corrections appliquées</h3>
              <ul style={{paddingLeft:'1rem', lineHeight:1.6}}>
                {log.map((l, i)=>(<li key={i}>{l}</li>))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
