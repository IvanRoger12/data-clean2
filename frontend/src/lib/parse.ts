import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Dataset, Row } from './utils'

export async function parseFiles(files: FileList, onProgress?: (p:number)=>void): Promise<Dataset> {
  const f = files[0]
  if (!f) throw new Error('No file')
  const name = f.name.toLowerCase()
  onProgress?.(10)
  let rows: Row[] = []
  if (name.endsWith('.csv')) rows = await parseCSV(f, onProgress)
  else if (name.endsWith('.xlsx') || name.endsWith('.xls')) rows = await parseXLSX(f, onProgress)
  else if (name.endsWith('.json')) rows = await parseJSON(f, onProgress)
  else if (name.endsWith('.txt')) rows = await parseTXT(f, onProgress)
  else throw new Error('Format non supporté')
  onProgress?.(80)
  const columns = inferColumns(rows)
  const preview = rows.slice(0, 1000)
  onProgress?.(95)
  return { rows, preview, columns, name: f.name }
}

function inferColumns(rows: Row[]): string[] {
  const first = rows[0] || {}
  return Object.keys(first)
}

function parseCSV(file: File, onProgress?: (p:number)=>void): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data as Row[]),
      error: reject,
      chunk: ()=> onProgress?.( (Math.random()*20)+20 )
    })
  })
}

async function parseXLSX(file: File, onProgress?: (p:number)=>void): Promise<Row[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const firstSheet = wb.SheetNames[0]
  const ws = wb.Sheets[firstSheet]
  onProgress?.(40)
  return XLSX.utils.sheet_to_json(ws, { defval: null }) as Row[]
}

async function parseJSON(file: File, onProgress?: (p:number)=>void): Promise<Row[]> {
  const text = await file.text()
  onProgress?.(30)
  const data = JSON.parse(text)
  if (Array.isArray(data)) return data as Row[]
  if (Array.isArray(data.data)) return data.data as Row[]
  // objet -> lignes
  return [data] as Row[]
}

async function parseTXT(file: File, onProgress?: (p:number)=>void): Promise<Row[]> {
  const text = await file.text()
  onProgress?.(25)
  const lines = text.split(/\r?\n/).filter(Boolean)
  // simple: première ligne = headers séparés par tabulation
  const headers = lines[0].split('\t')
  return lines.slice(1).map(l => {
    const parts = l.split('\t')
    const row: Row = {}
    headers.forEach((h, i)=> row[h]=parts[i] ?? null)
    return row
  })
}
