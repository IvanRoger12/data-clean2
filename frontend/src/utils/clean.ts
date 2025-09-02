import { Dataset, Row } from './types';
import { toPhoneE164 } from './detect';

// Applique une seule correction sur une colonne
export function applyCorrection(ds: Dataset, col: string, action: string, args?: any): Dataset {
  const rows = [...ds.rows];
  if (action === 'impute_mean') {
    const nums = rows.map(r => Number(String(r[col]).replace(',', '.'))).filter(v => !isNaN(v));
    const mean = nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null;
    if (mean !== null) rows.forEach(r => { if (!hasValue(r[col])) r[col] = roundSafe(mean); });
  } else if (action === 'impute_mode') {
    const freq = new Map<string, number>();
    rows.forEach(r => {
      const v = String(r[col] ?? '').trim();
      if (!v) return;
      freq.set(v, (freq.get(v) || 0) + 1);
    });
    let mode = null, best = 0;
    for (const [k, v] of freq.entries()) if (v > best) { best = v; mode = k; }
    if (mode !== null) rows.forEach(r => { if (!hasValue(r[col])) r[col] = mode; });
  } else if (action === 'trim_normalize') {
    rows.forEach(r => {
      let v = r[col];
      if (v == null) return;
      v = String(v).trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      r[col] = v;
    });
  } else if (action === 'standardize_email') {
    rows.forEach(r => { if (r[col] != null) r[col] = String(r[col]).trim().toLowerCase(); });
  } else if (action === 'standardize_date_iso') {
    rows.forEach(r => {
      const s = String(r[col] ?? '').trim();
      if (!s) return;
      const d = new Date(s);
      if (!isNaN(d.getTime())) r[col] = d.toISOString().slice(0, 10); // YYYY-MM-DD
    });
  } else if (action === 'standardize_phone_e164') {
    const country = args?.country ?? 'FR';
    rows.forEach(r => {
      const s = String(r[col] ?? '').trim();
      if (!s) return;
      const e164 = toPhoneE164(s, country);
      if (e164) r[col] = e164;
    });
  } else if (action === 'drop_duplicates') {
    const seen = new Set<string>();
    const deduped: Row[] = [];
    for (const r of rows) {
      const key = Object.values(r).join('|');
      if (!seen.has(key)) { seen.add(key); deduped.push(r); }
    }
    return { ...ds, rows: deduped, sampleRows: deduped.slice(0, 1000) };
  } else if (action === 'drop_duplicates_composite') {
    const keys: string[] = args?.keys ?? [col];
    const seen = new Set<string>();
    const deduped: Row[] = [];
    for (const r of rows) {
      const key = keys.map(k => String(r[k] ?? '')).join('|');
      if (!seen.has(key)) { seen.add(key); deduped.push(r); }
    }
    return { ...ds, rows: deduped, sampleRows: deduped.slice(0, 1000) };
  } else if (action === 'keep_as_is') {
    // no-op
  }
  return { ...ds, rows, sampleRows: rows.slice(0, 1000) };
}

function hasValue(v: any): boolean {
  return !(v === null || v === undefined || String(v).trim() === '');
}
function roundSafe(n: number) { return Math.round(n * 1000) / 1000; }
