export type Row = Record<string, any>
export type Dataset = { rows: Row[]; preview: Row[]; columns: string[]; name?: string }
export type PreviewPage = { index: number; rows: Row[] }

export type JobItem = {
  id: string
  name: string
  frequency: 'daily'|'weekly'|'monthly'
  time: string
  source: 'current'|'demo'|'url'|'api'|'db'
  status: 'running'|'completed'|'pending'|'failed'
  lastRun: string|null
  nextRun: string|null
}

export function paginate(arr: Row[], per=100): PreviewPage[] {
  const pages: PreviewPage[] = []
  for (let i=0;i<arr.length;i+=per) pages.push({ index: (i/per)+1, rows: arr.slice(i, i+per) })
  return pages
}

export function removeAccents(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function toISODate(input:string) {
  const d = new Date(input)
  if (isNaN(+d)) return null
  return d.toISOString().slice(0,10)
}

// IBAN validation simple
export function isValidIBAN(iban: string) {
  const s = iban.replace(/\s+/g,'').toUpperCase()
  if (!/^[A-Z0-9]+$/.test(s)) return false
  const rearranged = s.slice(4) + s.slice(0,4)
  const converted = rearranged.replace(/[A-Z]/g, (ch) => (ch.charCodeAt(0) - 55).toString())
  // mod 97
  let total = ''
  for (let i=0;i<converted.length;i++) {
    total += converted[i]
    const num = parseInt(total,10)
    if (num > 1e7) total = String(num % 97)
  }
  return (parseInt(total,10) % 97) === 1
}

export function mode<T>(arr: T[]): T|undefined {
  const m = new Map<T, number>()
  arr.forEach(v=> m.set(v, (m.get(v)||0)+1))
  let best: T|undefined; let bestC=-1
  m.forEach((c,v)=>{ if (c>bestC){best=v;bestC=c} })
  return best
}
