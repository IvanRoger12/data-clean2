import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Dataset, Row } from './types';

// Lit CSV/Excel/JSON/TXT -> Dataset (preview 1k)
export async function loadFile(file: File): Promise<Dataset> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  if (['csv', 'txt'].includes(ext)) {
    const text = await file.text();
    const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
    const rows = parsed.data || [];
    return makeDataset(rows, file.name, 'CSV/TXT');
  } else if (['xlsx', 'xls'].includes(ext)) {
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    // Choix de feuille: on prend la première pour MVP (peux étendre)
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: Row[] = XLSX.utils.sheet_to_json(ws, { defval: null });
    return makeDataset(rows, file.name, sheetName);
  } else if (ext === 'json') {
    const text = await file.text();
    const json = JSON.parse(text);
    const rows = Array.isArray(json) ? json : (json?.data ?? []);
    if (!Array.isArray(rows)) throw new Error('JSON non compatible: attendu un array de lignes.');
    return makeDataset(rows, file.name, 'JSON');
  } else {
    throw new Error('Format non supporté (CSV, XLSX, JSON, TXT).');
  }
}

function makeDataset(rows: Row[], workbookName: string, sheetName: string): Dataset {
  const sample = rows.slice(0, 1000);
  const columns = inferColumns(sample);
  return { rows, columns, sampleRows: sample, workbookName, sheetName };
}

function inferColumns(sample: Row[]): string[] {
  const set = new Set<string>();
  for (const r of sample) Object.keys(r).forEach((k) => set.add(k));
  return Array.from(set);
}
