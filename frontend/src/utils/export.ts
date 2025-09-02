import * as XLSX from 'xlsx';
import { Dataset } from './types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadCSV(ds: Dataset, filename = 'dataclean_clean.csv') {
  const ws = XLSX.utils.json_to_sheet(ds.rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  triggerDownload(csv, filename, 'text/csv;charset=utf-8;');
}

export function downloadExcel(ds: Dataset, filename = 'dataclean_clean.xlsx') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(ds.rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Cleaned');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerDownload(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}

export function downloadPDFReport(summary: {
  score: number;
  kpis: { duplicates: number; missingFixed: number; anomalies: number; lines: number; columns: number; };
  insights: string[];
}, filename = 'dataclean_report.pdf') {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('DataClean AI - Rapport Avant/Après', 14, 16);
  doc.setFontSize(11);
  doc.text(`Score global: ${summary.score}%`, 14, 26);
  doc.text(`KPI - Doublons: ${summary.kpis.duplicates}% | Manquants corrigés: ${summary.kpis.missingFixed}% | Anomalies: ${summary.kpis.anomalies}`, 14, 34);
  doc.text(`Lignes: ${summary.kpis.lines} | Colonnes: ${summary.kpis.columns}`, 14, 42);

  autoTable(doc, {
    startY: 50,
    head: [['Top insights']],
    body: summary.insights.map((i) => [i]),
    styles: { fontSize: 9 }
  });

  doc.save(filename);
}

export async function downloadZIPAll(ds: Dataset, summary: any, filename = 'dataclean_all.zip') {
  // mini zip sans lib: on crée 2 blobs et on télécharge séparément (MVP).
  // (Si tu veux un vrai .zip: ajoute JSZip; pour MVP on déclenche 2 downloads)
  downloadExcel(ds, 'dataset_nettoye.xlsx');
  downloadPDFReport(summary, 'rapport.pdf');
  // tu peux aussi ajouter JSZip si tu veux un seul fichier zip.
}

function triggerDownload(data: string | Blob, filename: string, mime?: string) {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime || 'application/octet-stream' }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
