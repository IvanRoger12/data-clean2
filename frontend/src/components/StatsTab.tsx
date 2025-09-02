import React, { useEffect, useMemo, useRef } from 'react'
import { Dataset } from '../lib/utils'
import { computeStats } from '../lib/profile'
import Chart from 'chart.js/auto'

export default function StatsTab({ dataset }: { dataset: Dataset|null }) {
  const stats = useMemo(()=> dataset ? computeStats(dataset) : null, [dataset])
  const numCanvas = useRef<HTMLCanvasElement>(null)
  const catCanvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!stats) return
    let numChart: Chart|undefined, catChart: Chart|undefined
    if (numCanvas.current && stats.numeric.length>0) {
      const first = stats.numeric[0]
      const labels = first.hist.labels
      const values = first.hist.values
      numChart = new Chart(numCanvas.current, {
        type: 'bar',
        data: { labels, datasets: [{ label: `Distribution ${first.name}`, data: values }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
      })
    }
    if (catCanvas.current && stats.categorical.length>0) {
      const first = stats.categorical[0]
      const labels = first.top.map(x=>x.value)
      const values = first.top.map(x=>x.count)
      catChart = new Chart(catCanvas.current, {
        type: 'pie',
        data: { labels, datasets: [{ data: values }] },
        options: { responsive: true }
      })
    }
    return ()=>{ numChart?.destroy(); catChart?.destroy() }
  }, [stats])

  if (!dataset) return <div className="badge">Uploadez un fichier d’abord</div>
  if (!stats) return null

  return (
    <div>
      <h2>📈 Statistiques Descriptives</h2>
      <p style={{opacity:.7, marginTop:6}}>Résumés et graphiques après nettoyage.</p>

      <div style={{display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12, marginTop:16}}>
        <div className="kpi"><h4>Lignes</h4><div className="val">{dataset.rows.length.toLocaleString()}</div></div>
        <div className="kpi"><h4>Colonnes</h4><div className="val">{dataset.columns.length}</div></div>
        <div className="kpi"><h4>% Manquants (moy.)</h4><div className="val">{Math.round(stats.avgMissingPct)}%</div></div>
        <div className="kpi"><h4>% Doublons (moy.)</h4><div className="val">{Math.round(stats.avgDupPct)}%</div></div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:16}}>
        <div style={{background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:12}}>
          <h3 style={{marginBottom:8}}>Histogramme (numérique)</h3>
          <canvas ref={numCanvas} height={160} />
        </div>
        <div style={{background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:12}}>
          <h3 style={{marginBottom:8}}>Répartition (catégoriel)</h3>
          <canvas ref={catCanvas} height={160} />
        </div>
      </div>
    </div>
  )
}
