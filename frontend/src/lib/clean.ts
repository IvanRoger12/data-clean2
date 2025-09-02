import { Dataset, Row, removeAccents, mode, toISODate } from './utils'
import { DatasetProfile, buildProfile, ColumnIssue } from './profile'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { distance as levenshtein } from 'fastest-levenshtein'

export type Correction =
  | { type:'impute'; label:string; selected?:boolean; column:string; method:'mean'|'mode' }
  | { type:'normalize_text'; label:string; selected?:boolean; column:string }
  | { type:'standardize_email'; label:string; selected?:boolean; column:string }
  | { type:'standardize_date'; label:string; selected?:boolean; column:string }
  | { type:'standardize_phone'; label:string; selected?:boolean; column:string; region?:string }
  | { type:'dedupe'; label:string; selected?:boolean; column:string; fuzzyThreshold?:number }

export function applyCorrections(dataset: Dataset, profile: DatasetProfile, proposals: Record<string, Correction[]>) {
  let rows: Row[] = dataset.rows.map(r=>({...r}))
  const journal: string[] = []

  for (const [col, list] of Object.entries(proposals)) {
    for (const corr of list) {
      if (!corr.selected) continue
      if (corr.type==='impute') {
        const values = rows.map(r=>r[col]).filter(v=>v!==null && v!==undefined && v!=='')
        if (corr.method==='mean') {
          const nums = values.map(v=>parseFloat(v)).filter(v=>!Number.isNaN(v))
          const mean = nums.reduce((a,b)=>a+b,0)/(nums.length||1)
          rows.forEach(r=>{ if (r[col]===null || r[col]===undefined || r[col]==='') r[col]= mean })
          journal.push(`Imputation moyenne appliquée sur ${col}.`)
        } else {
          const m = mode(values)
          rows.forEach(r=>{ if (r[col]===null || r[col]===undefined || r[col]==='') r[col]= m ?? r[col] })
          journal.push(`Imputation mode appliquée sur ${col}.`)
        }
      }
      if (corr.type==='normalize_text') {
        rows.forEach(r => {
          const v = r[col]; if (v===null || v===undefined) return
          r[col] = removeAccents(String(v)).trim()
        })
        journal.push(`Trim + accents normalisés sur ${col}.`)
      }
      if (corr.type==='standardize_email') {
        rows.forEach(r => {
          const v = r[col]; if (v===null || v===undefined) return
          r[col] = String(v).trim().toLowerCase()
        })
        journal.push(`Emails standardisés sur ${col}.`)
      }
      if (corr.type==='standardize_date') {
        rows.forEach(r => {
          const v = r[col]; if (!v) return
          const iso = toISODate(String(v)); if (iso) r[col] = iso
        })
        journal.push(`Dates ISO 8601 standardisées sur ${col}.`)
      }
      if (corr.type==='standardize_phone') {
        rows.forEach(r => {
          const v = r[col]; if (!v) return
          const pn = parsePhoneNumberFromString(String(v), corr.region || 'FR')
          if (pn) r[col] = pn.number // E.164
        })
        journal.push(`Téléphones standardisés (E.164) sur ${col}.`)
      }
      if (corr.type==='dedupe') {
        const key = col
        const seen = new Set<string>()
        const fuzzy = corr.fuzzyThreshold ?? 0.2 // distance relative max 0.2
        const kept: Row[] = []
        for (const r of rows) {
          const v = String(r[key]??'').trim()
          if (v==='' ){ kept.push(r); continue }
          let isDup = false
          if (seen.has(v)) isDup = true
          // fuzzy check (comparaison avec valeurs déjà retenues)
          if (!isDup && fuzzy>0) {
            for (const rr of kept) {
              const vv = String(rr[key]??'')
              if (!vv) continue
              const dist = levenshtein(v, vv)
              const rel = dist / Math.max(1, Math.max(v.length, vv.length))
              if (rel <= fuzzy) { isDup = true; break }
            }
          }
          if (!isDup) { kept.push(r); seen.add(v) }
        }
        const removed = rows.length - kept.length
        rows = kept
        journal.push(`Dédoublonnage sur ${col} : ${removed} lignes supprimées.`)
      }
    }
  }

  const updated: Dataset = { ...dataset, rows, preview: rows.slice(0,1000) }
  const newProfile = buildProfile({ ...updated, preview: updated.preview })
  return { updated, journal, newProfile }
}
