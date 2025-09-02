import { Dataset, Row, removeAccents, isValidIBAN, mode } from './utils'
import { Correction } from './clean'
import { distance as levenshtein } from 'fastest-levenshtein'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

export type ColType = 'number'|'text'|'date'|'email'|'phone'|'url'|'boolean'|'iban'

export type ColumnIssue = {
  name: string
  type: ColType
  missingPct: number
  invalidPct: number
  duplicatesPct: number
  anomalyCount?: number
  score: number
}

export type DatasetProfile = {
  columns: ColumnIssue[]
  globalScore: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function detectTypevalues(values: any[]): ColType {
  let num=0, em=0, ph=0, ur=0, bo=0, dt=0, ib=0
  let total=0
  for (const v of values) {
    if (v===null || v===undefined || v==='') continue
    total++
    const s = String(v).trim()
    if (!Number.isNaN(parseFloat(s)) && isFinite(Number(s))) num++
    if (EMAIL_RE.test(s)) em++
    try { new URL(s); ur++ } catch {}
    if (['true','false','0','1','oui','non','yes','no'].includes(s.toLowerCase())) bo++
    if (!isNaN(Date.parse(s))) dt++
    if (isValidIBAN(s)) ib++
    const pn = parsePhoneNumberFromString(s, 'FR'); if (pn) ph++
  }
  const counts: [ColType, number][] = [
    ['email', em], ['phone', ph], ['url', ur], ['iban', ib],
    ['date', dt], ['boolean', bo], ['number', num]
  ]
  counts.sort((a,b)=>b[1]-a[1])
  return counts[0][1]/(total||1) > 0.5 ? counts[0][0] : 'text'
}

export function buildProfile(dataset: Dataset): DatasetProfile {
  const cols = dataset.columns
  const rows = dataset.preview // profil basé sur preview (1k)
  const issues: ColumnIssue[] = []

  for (const c of cols) {
    const values = rows.map(r => r[c])
    const total = values.length
    const missing = values.filter(v => v===null || v===undefined || v==='').length
    const type = detectTypevalues(values)
    // invalid
    let invalid=0
    for (const v of values) {
      if (v===null || v===undefined || v==='') continue
      const s = String(v).trim()
      if (type==='email' && !EMAIL_RE.test(s)) invalid++
      else if (type==='url') { try { new URL(s) } catch { invalid++ } }
      else if (type==='boolean' && !['true','false','0','1','oui','non','yes','no'].includes(s.toLowerCase())) invalid++
      else if (type==='date' && isNaN(Date.parse(s))) invalid++
      else if (type==='iban' && !isValidIBAN(s)) invalid++
      else if (type==='phone') { const pn = parsePhoneNumberFromString(s, 'FR'); if (!pn) invalid++ }
      else if (type==='number' && Number.isNaN(parseFloat(s))) invalid++
    }
    // duplicates (approx sur preview)
    const uniq = new Set(values.map(v => (v===null||v===undefined)?'':String(v).trim()))
    const duplicatesPct = total>0 ? Math.max(0, 100 - (uniq.size/total)*100) : 0

    // anomalies/outliers (z-score simple pour number)
    let anomalyCount=0
    if (type==='number') {
      const nums = values.map(v => parseFloat(v)).filter(v=>!Number.isNaN(v))
      const mean = nums.reduce((a,b)=>a+b,0)/(nums.length||1)
      const sd = Math.sqrt(nums.reduce((a,b)=>a+(b-mean)*(b-mean),0)/(nums.length||1))
      anomalyCount = nums.filter(x => sd>0 ? Math.abs((x-mean)/sd)>3 : false).length
    }

    const missingPct = total? (missing/total)*100 : 0
    const invalidPct = total? (invalid/total)*100 : 0
    const score = Math.max(0, 100 - (missingPct*0.5 + invalidPct*0.4 + duplicatesPct*0.1))
    issues.push({ name:c, type, missingPct, invalidPct, duplicatesPct, anomalyCount, score })
  }
  const global = issues.reduce((a,c)=>a+c.score,0)/(issues.length||1)
  return { columns: issues, globalScore: global }
}

export function defaultProposal(col: ColumnIssue): Correction[] {
  const arr: Correction[] = []
  if (col.missingPct>0) {
    arr.push({ type:'impute', label:'Imputer manquants', selected:true, method: col.type==='number'?'mean':'mode', column: col.name })
  }
  if (col.type==='email') arr.push({ type:'standardize_email', label:'Standardiser emails', selected:true, column: col.name })
  if (col.type==='date') arr.push({ type:'standardize_date', label:'Dates ISO 8601', selected:true, column: col.name })
  if (col.type==='phone') arr.push({ type:'standardize_phone', label:'Téléphones E.164', selected:true, column: col.name, region:'FR' })
  // trim/accents pour texte
  if (col.type==='text') arr.push({ type:'normalize_text', label:'Normaliser texte (trim+accents)', selected:true, column: col.name })
  // duplicates (simple). Le fuzzy se gère au moment de l’application avec un seuil.
  if (col.duplicatesPct>0) arr.push({ type:'dedupe', label:'Supprimer doublons', selected:true, column: col.name })
  return arr
}

export function computeStats(dataset: Dataset) {
  const cols = dataset.columns
  const rows = dataset.rows
  const colMissing: number[] = []
  const colDup: number[] = []
  const numeric:{ name:string, values:number[], hist:{labels:string[], values:number[]} }[] = []
  const categorical:{ name:string, top:{value:string,count:number}[] }[] = []

  for (const c of cols) {
    const vals = rows.map(r => r[c])
    const total = vals.length
    const missing = vals.filter(v => v===null || v===undefined || v==='').length
    colMissing.push(total? (missing/total)*100 : 0)
    const uniq = new Set(vals.map(v => String(v??'')))
    colDup.push(total? Math.max(0,100 - (uniq.size/total)*100) : 0)

    const numVals = vals.map(v => parseFloat(v)).filter(v=>!Number.isNaN(v))
    if (numVals.length > total*0.5) {
      // histogramme simple sur 10 bacs
      const min = Math.min(...numVals), max = Math.max(...numVals)
      const bins = new Array(10).fill(0)
      const labels = new Array(10).fill(0).map((_,i)=>`${(min + (i*(max-min)/10)).toFixed(1)}`)
      numVals.forEach(v => {
        const idx = Math.min(9, Math.max(0, Math.floor( ( (v-min)/(max-min || 1) )*10 )))
        bins[idx]++
      })
      numeric.push({ name:c, values:numVals, hist:{ labels, values: bins } })
    } else {
      const m = new Map<string, number>()
      vals.forEach(v => {
        const sv = String(v??'').trim()
        if (!sv) return
        m.set(sv, (m.get(sv)||0)+1)
      })
      const top = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([value,count])=>({value,count}))
      categorical.push({ name:c, top })
    }
  }

  return {
    avgMissingPct: colMissing.reduce((a,b)=>a+b,0)/(colMissing.length||1),
    avgDupPct: colDup.reduce((a,b)=>a+b,0)/(colDup.length||1),
    numeric,
    categorical
  }
}
