import { AnalysisResult, ColumnIssue, ColumnType, Dataset, Row } from './types';
import { detectColumnType, isEmail, isURL, isIBAN, isPhoneE164Like } from './detect';

// petite distance Levenshtein pour fuzzy simple (démo)
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((100 * n) / d);
}

export function analyzeDataset(ds: Dataset): AnalysisResult {
  const rows = ds.sampleRows;
  const columns = ds.columns;
  const N = rows.length;

  const issues: ColumnIssue[] = columns.map((col) => {
    const values = rows.map(r => r[col]);
    const type = detectColumnType(values);
    const missing = values.filter(v => v === null || v === undefined || String(v).trim() === '').length;
    const missingPct = pct(missing, N);

    // duplicates exact
    const seen = new Set<string>();
    let dup = 0;
    for (const v of values) {
      const k = String(v ?? '');
      if (k && seen.has(k)) dup++;
      else if (k) seen.add(k);
    }
    const duplicatePct = pct(dup, N);

    // invalid by type
    let invalid = 0;
    if (type === 'email') invalid = values.filter(v => v && !isEmail(String(v))).length;
    else if (type === 'url') invalid = values.filter(v => v && !isURL(String(v))).length;
    else if (type === 'iban') invalid = values.filter(v => v && !isIBAN(String(v))).length;
    else if (type === 'phone') invalid = values.filter(v => v && !isPhoneE164Like(String(v))).length;
    else if (type === 'date') {
      invalid = values.filter(v => {
        const s = String(v || '').trim();
        const ok = !isNaN(Date.parse(s));
        return s && !ok;
      }).length;
    }
    const invalidPct = pct(invalid, N);

    // outliers (numérique) via IQR simple
    let outlierPct = 0;
    if (type === 'number') {
      const nums = values.map(v => Number(String(v).replace(',', '.'))).filter(v => !isNaN(v));
      nums.sort((a, b) => a - b);
      const q1 = quantile(nums, 0.25), q3 = quantile(nums, 0.75);
      const iqr = q3 - q1;
      const low = q1 - 1.5 * iqr, high = q3 + 1.5 * iqr;
      const outliers = nums.filter(v => v < low || v > high).length;
      outlierPct = pct(outliers, N);
    }

    // score (complétude + validité + unicité)
    const completeness = 100 - missingPct;
    const validity = 100 - invalidPct;
    const uniqueness = 100 - duplicatePct;
    const score = Math.max(0, Math.round((0.45 * completeness + 0.35 * validity + 0.2 * uniqueness)));

    const suggestions = buildSuggestions(col, type, { missingPct, duplicatePct, invalidPct });

    return { name: col, type, missingPct, duplicatePct, invalidPct, outlierPct, score, suggestions };
  });

  // Fuzzy dupe rapide sur colonnes candidates (email, phone, name-like)
  const maybeName = columns.find(c => /name|nom|fullname|full_name/i.test(c));
  if (maybeName) {
    const vals = rows.map(r => String(r[maybeName] ?? '')).filter(Boolean);
    const flagged = fuzzyDuplicateRate(vals);
    const idx = issues.findIndex(i => i.name === maybeName);
    if (idx >= 0 && flagged > 0) {
      issues[idx].duplicatePct = Math.min(100, issues[idx].duplicatePct + flagged);
      if (!issues[idx].suggestions.find(s => s.apply === 'drop_duplicates')) {
        issues[idx].suggestions.push({
          id: `dropdupe-${maybeName}`,
          label: 'Supprimer doublons (fuzzy)',
          apply: 'drop_duplicates'
        });
      }
    }
  }

  const errorsOnly = issues.filter(i => i.missingPct > 0 || i.duplicatePct > 0 || i.invalidPct > 0 || i.outlierPct > 0);
  const insights = buildInsights(errorsOnly, ds);

  const globalScore = Math.round(
    issues.reduce((acc, i) => acc + i.score, 0) / Math.max(1, issues.length)
  );

  const kpis = {
    duplicates: Math.round(issues.reduce((a, i) => a + i.duplicatePct, 0) / Math.max(1, issues.length)),
    missingFixed: 0, // sera mis à jour après nettoyage
    anomalies: errorsOnly.length,
    lines: ds.rows.length,
    columns: ds.columns.length
  };

  return { issues: errorsOnly, insights, kpis, globalScore };
}

function buildSuggestions(col: string, type: ColumnType, m: { missingPct: number; duplicatePct: number; invalidPct: number; }): any[] {
  const s: any[] = [];
  if (m.duplicatePct > 0) {
    s.push({ id: `dedupe-${col}`, label: 'Supprimer doublons (colonne)', apply: 'drop_duplicates' });
    s.push({ id: `dedupe2-${col}`, label: 'Dédoublonnage clés composites', apply: 'drop_duplicates_composite', args: { keys: [col] } });
  }
  if (m.missingPct > 0) {
    s.push({ id: `impute-mean-${col}`, label: 'Imputer valeurs manquantes (moyenne)', apply: 'impute_mean' });
    s.push({ id: `impute-mode-${col}`, label: 'Imputer valeurs manquantes (mode)', apply: 'impute_mode' });
  }
  if (type === 'text') {
    s.push({ id: `trim-${col}`, label: 'Normaliser texte (trim/accents)', apply: 'trim_normalize' });
  }
  if (type === 'email') {
    s.push({ id: `std-email-${col}`, label: 'Standardiser emails (lowercase)', apply: 'standardize_email' });
  }
  if (type === 'date') {
    s.push({ id: `std-date-${col}`, label: 'Standardiser dates (ISO 8601)', apply: 'standardize_date_iso' });
  }
  if (type === 'phone') {
    s.push({ id: `std-phone-${col}`, label: 'Téléphones au format E.164', apply: 'standardize_phone_e164', args: { country: 'FR' } });
  }
  s.push({ id: `keep-${col}`, label: 'Garder tel quel', apply: 'keep_as_is' });
  return s;
}

function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0;
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) return arr[base] + rest * (arr[base + 1] - arr[base]);
  return arr[base];
}

function fuzzyDuplicateRate(values: string[]): number {
  if (values.length < 2) return 0;
  let near = 0, total = 0;
  for (let i = 0; i < Math.min(values.length, 200); i++) {
    for (let j = i + 1; j < Math.min(values.length, 200); j++) {
      total++;
      const a = values[i].toLowerCase().trim();
      const b = values[j].toLowerCase().trim();
      if (!a || !b) continue;
      const d = levenshtein(a, b);
      const maxLen = Math.max(a.length, b.length);
      const sim = 1 - d / Math.max(1, maxLen);
      if (sim > 0.9) near++;
    }
  }
  return Math.min(100, Math.round((near / Math.max(1, total)) * 100));
}
