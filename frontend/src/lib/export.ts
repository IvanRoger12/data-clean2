import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { Dataset } from './utils'
import { DatasetProfile } from './profile'

export function downloadCSV(dataset: Dataset) {
  const rows = dataset.rows
  const cols = dataset.columns
  const header = cols.join(',')
  const lines = rows.map(r => cols.map(c => JSON.stringify(r[c]??'')).join(','))
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
  trigger(blob, (dataset.name||'dataset').replace(/\.[^.]+$/,'')+'_clean.csv')
}

export function downloadXLSX(dataset: Dataset) {
  const ws = XLSX.utils.json_to_sheet(dataset.rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'clean')
  const buf = XLSX.write(wb, {type:'array', bookType:'xlsx'})
  const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
  trigger(blob, (dataset.name||'dataset').replace(/\.[^.]+$/,'')+'_clean.xlsx')
}

export function downloadPDFReport(profile: DatasetProfile, dataset: Dataset) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Rapport Qualité — DataClean AI', 14, 18)
  doc.setFontSize(11)
  doc.text(`Fichier: ${dataset.name||'—'}`, 14, 26)
  doc.text(`Score global: ${Math.round(profile.globalScore)}%`, 14, 34)
  let y = 44
  doc.setFontSize(12)
  doc.text('KPIs par colonne (extrait):', 14, y); y+=8
  doc.setFontSize(10)
  profile.columns.slice(0, 25).forEach(c => {
    doc.text(`• ${c.name}: missing ${Math.round(c.missingPct)}%, invalid ${Math.round(c.invalidPct)}%, dup ${Math.round(c.duplicatesPct)}%, score ${Math.round(c.score)}%`, 14, y)
    y+=6; if (y>280) { doc.addPage(); y=20 }
  })
  const blob = doc.output('blob')
  trigger(blob, 'rapport_qualite.pdf')
}

export async function downloadZIPAll(profile: DatasetProfile, dataset: Dataset) {
  const zip = new JSZip()
  // CSV
  const cols = dataset.columns
  const header = cols.join(',')
  const lines = dataset.rows.map(r => cols.map(c => JSON.stringify(r[c]??'')).join(','))
  zip.file('dataset_clean.csv', [header, ...lines].join('\n'))
  // XLSX
  const ws = XLSX.utils.json_to_sheet(dataset.rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'clean')
  const buf = XLSX.write(wb, {type:'array', bookType:'xlsx'})
  zip.file('dataset_clean.xlsx', buf)
  // Rapport PDF (simple)
  const pdf = new jsPDF()
  pdf.setFontSize(16); pdf.text('Rapport Qualité — DataClean AI', 14, 18)
  pdf.setFontSize(11); pdf.text(`Score global: ${Math.round(profile.globalScore)}%`, 14, 26)
  let y=36; pdf.setFontSize(10)
  profile.columns.slice(0, 40).forEach(c => { pdf.text(`• ${c.name}: score ${Math.round(c.score)}%`, 14, y); y+=6; if (y>280){pdf.addPage(); y=20} })
  zip.file('rapport_qualite.pdf', pdf.output('arraybuffer'))

  const blob = await zip.generateAsync({type:'blob'})
  trigger(blob, 'export_dataclean.zip')
}

function trigger(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
