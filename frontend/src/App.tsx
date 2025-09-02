import React, { useEffect, useMemo, useRef, useState } from "react";

/* ======================================================
   i18n FR / EN
====================================================== */
type Lang = "fr" | "en";
const D: Record<Lang, Record<string, string>> = {
  fr: {
    app_title: "DataClean AI",
    subtitle: "Assistant IA pour nettoyage de données d'entreprise",
    pro: "Pro",
    nav_analyze: "Analyser",
    nav_stats: "Statistiques descriptives",
    nav_schedule: "Planifier",
    nav_jobs: "Jobs",

    drop_title: "Déposez vos fichiers ou cliquez ici",
    drop_sub:
      "CSV, Excel, JSON, TXT (≤ 50 Mo). Vos données restent dans votre navigateur.",
    size_ok: "Taille max : 50 Mo",
    free_limit: "Analyse gratuite : 1000 lignes",
    privacy: "Traitement local sécurisé",
    analyze_progress: "Analyse du fichier…",
    dataset_loaded: "Fichier chargé :",


    // Aperçu
    preview_title: "Aperçu (10 premières lignes)",
    before: "Avant",
    after: "Après",
    sheet: "Feuille",
    no_data_yet: "Aucune donnée à afficher pour l’instant.",

    // KPI
    score_title: "Score global",
    rows_analyzed: "Lignes analysées",
    cols_found: "Colonnes trouvées",
    issues_found: "Problèmes détectés",

    // Colonnes / actions
    problems_cols: "Colonnes avec problèmes",
    only_problem_cols: "Seules les colonnes en erreur sont listées.",
    type: "type",
    quality: "Qualité",
    missing: "Manquants",
    proposal: "Proposition",
    accept: "Valider",
    reject: "Infirmer",
    accept_all: "Valider tout",
    apply_selected: "Appliquer les corrections validées",
    download_csv: "Télécharger CSV propre",
    reset: "Réinitialiser",
    reset_ok: "Interface réinitialisée.",
    apply_all_ok: "Corrections appliquées.",

    // Propositions
    prop_dedupe: "Supprimer les doublons",
    prop_impute_mean: "Imputer les manquants (moyenne)",
    prop_impute_mode: "Imputer les manquants (mode)",
    prop_standardize: "Standardiser le format",

    // Stats
    stats_title: "Statistiques Descriptives",
    stats_missing_by_col: "Manquants par colonne",
    stats_synth: "Synthèse erreurs moyennes",
    mean: "Moyenne",
    median: "Médiane",
    std: "Écart-type",
    interpretation: "Interprétation",

    // Planifier
    schedule_title: "Planifier un job",
    job_name: "Nom du job",
    frequency: "Fréquence",
    freq_daily: "Quotidien",
    freq_weekly: "Hebdomadaire",
    freq_monthly: "Mensuel",
    run_time: "Heure d’exécution",
    source: "Source",
    src_current: "Fichier courant",
    src_demo: "Dataset démo",
    create_job: "Créer le job",
    schedules: "Planifications",
    dry_run: "Dry-run",
    run_now: "Run now",
    download_ics: "Télécharger .ICS",
    delete: "Supprimer",
    next_run: "Prochaine exécution",
    last_dryrun: "Dernier dry-run",

    // Jobs
    jobs_title: "Historique des jobs",
    status: "Statut",
    running: "en cours",
    completed: "terminé",
    failed: "échec",
    improved_from_to: "amélioré de {a}% à {b}%",
    download_result: "Télécharger résultat",

    // Assistant
    assistant: "Assistant IA",
    expert: "Expert en nettoyage de données",
    ask_placeholder: "Posez votre question sur vos données…",
    ai_thinking: "L’IA réfléchit",
    toggled_to: "Langue changée en",

    // Logs dynamiques
    log_loaded: "Fichier chargé : {name}",
    log_dedupe: "🧹 {col} : doublons supprimés ({n})",
    log_impute_mean: "➕ {col} : imputation moyenne ({v})",
    log_impute_mode: "➕ {col} : imputation mode ({v})",
    log_standardize: "✨ {col} : standardisation",
    log_applied: "✅ Corrections appliquées",
  },
  en: {
    app_title: "DataClean AI",
    subtitle: "AI assistant for enterprise data cleaning",
    pro: "Pro",
    nav_analyze: "Analyze",
    nav_stats: "Descriptive statistics",
    nav_schedule: "Schedule",
    nav_jobs: "Jobs",

    drop_title: "Drop your files or click here",
    drop_sub:
      "CSV, Excel, JSON, TXT (≤ 50 MB). Your data stays in your browser.",
    size_ok: "Max size: 50 MB",
    free_limit: "Free analysis: 1k rows",
    privacy: "Local secure processing",
    analyze_progress: "Analyzing file…",
    dataset_loaded: "File loaded:",

    preview_title: "Preview (first 10 rows)",
    before: "Before",
    after: "After",
    sheet: "Sheet",
    no_data_yet: "No data to show yet.",

    score_title: "Global score",
    rows_analyzed: "Rows analyzed",
    cols_found: "Columns found",
    issues_found: "Issues detected",

    problems_cols: "Columns with issues",
    only_problem_cols: "Only columns with issues are listed.",
    type: "type",
    quality: "Quality",
    missing: "Missing",
    proposal: "Proposal",
    accept: "Accept",
    reject: "Reject",
    accept_all: "Accept all",
    apply_selected: "Apply validated fixes",
    download_csv: "Download cleaned CSV",
    reset: "Reset",
    reset_ok: "UI reset.",
    apply_all_ok: "Fixes applied.",

    prop_dedupe: "Remove duplicates",
    prop_impute_mean: "Impute missing (mean)",
    prop_impute_mode: "Impute missing (mode)",
    prop_standardize: "Standardize format",

    stats_title: "Descriptive Statistics",
    stats_missing_by_col: "Missing by column",
    stats_synth: "Average error synthesis",
    mean: "Mean",
    median: "Median",
    std: "Std. dev.",
    interpretation: "Interpretation",

    schedule_title: "Schedule a job",
    job_name: "Job name",
    frequency: "Frequency",
    freq_daily: "Daily",
    freq_weekly: "Weekly",
    freq_monthly: "Monthly",
    run_time: "Run time",
    source: "Source",
    src_current: "Current file",
    src_demo: "Demo dataset",
    create_job: "Create job",
    schedules: "Schedules",
    dry_run: "Dry-run",
    run_now: "Run now",
    download_ics: "Download .ICS",
    delete: "Delete",
    next_run: "Next run",
    last_dryrun: "Last dry-run",

    jobs_title: "Jobs history",
    status: "Status",
    running: "running",
    completed: "completed",
    failed: "failed",
    improved_from_to: "improved from {a}% to {b}%",
    download_result: "Download result",

    assistant: "AI Assistant",
    expert: "Data-cleaning expert",
    ask_placeholder: "Ask a question about your data…",
    ai_thinking: "AI is thinking",
    toggled_to: "Language switched to",

    log_loaded: "File loaded: {name}",
    log_dedupe: "🧹 {col}: duplicates removed ({n})",
    log_impute_mean: "➕ {col}: mean imputation ({v})",
    log_impute_mode: "➕ {col}: mode imputation ({v})",
    log_standardize: "✨ {col}: standardized",
    log_applied: "✅ Fixes applied"
  }
};

const useI18n = () => {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem("lang") as Lang) || "fr"
  );
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useMemo(
    () => (k: string, p?: Record<string, string | number>) => {
      const s = D[lang][k] ?? k;
      if (!p) return s;
      return Object.keys(p).reduce(
        (acc, key) => acc.replaceAll(`{${key}}`, String(p[key])),
        s
      );
    },
    [lang]
  );

  const toggle = () =>
    setLang((prev) => {
      const n = prev === "fr" ? "en" : "fr";
      localStorage.setItem("lang", n);
      return n;
    });

  return { lang, t, toggle };
};

/* ======================================================
   Helpers & types
====================================================== */
type Row = Record<string, any>;
type ColType =
  | "number"
  | "text"
  | "date"
  | "email"
  | "phone"
  | "url"
  | "boolean"
  | "iban"
  | "unknown";

type ColMetrics = {
  name: string;
  type: ColType;
  missingPct: number; // %
  duplicatesPct: number; // %
  invalidPct: number; // %
  quality: number; // 0..100
};

type Decision = "pending" | "accept" | "reject";
type ColumnAction = {
  dedupe: boolean;
  impute: "none" | "mean" | "mode";
  standardize: boolean;
  decision: Decision;
};

type Schedule = {
  id: string;
  name: string;
  freq: "daily" | "weekly" | "monthly";
  time: string; // HH:mm
  source: "current" | "demo";
  createdAt: number;
  lastDryRun?: number;
  nextRunISO?: string;
};

type Job = {
  id: string;
  name: string;
  status: "running" | "completed" | "failed";
  at: number;
  fromScore?: number;
  toScore?: number;
  resultKey?: string; // localStorage key for CSV
};

type LogEntry =
  | { k: "log_loaded"; name: string }
  | { k: "log_dedupe"; col: string; n: number }
  | { k: "log_impute_mean"; col: string; v: number }
  | { k: "log_impute_mode"; col: string; v: string }
  | { k: "log_standardize"; col: string }
  | { k: "log_applied" };

const badge: React.CSSProperties = {
  padding: "4px 10px",
  background: "rgba(255,255,255,0.06)",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  fontSize: 12
};
const darkInput: React.CSSProperties = {
  background: "#202433",
  color: "#e5e7eb",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: 8,
  padding: "10px 12px",
  appearance: "none" as any
};

const isBlank = (v: any) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

const asNumber = (v: any) => {
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const median = (a: number[]) => {
  const b = a.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!b.length) return NaN;
  const m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};
const stddev = (a: number[]) => {
  const v = a.filter((n) => Number.isFinite(n));
  if (!v.length) return NaN;
  const m = v.reduce((s, n) => s + n, 0) / v.length;
  const vv = v.reduce((s, n) => s + (n - m) ** 2, 0) / v.length;
  return Math.sqrt(vv);
};

const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const reURL = /^(https?:\/\/)?([a-z0-9\-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;
const rePhone = /^\+?[0-9 ()\-]{6,}$/;
const reIBAN = /^[A-Z]{2}[0-9A-Z]{13,30}$/;

const toISODate = (v: any) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const normalizeText = (s: any) =>
  typeof s === "string"
    ? s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim()
    : s;
const standardizePhone = (s: any) => {
  if (typeof s !== "string") return s;
  let t = s.replace(/[^\d+]/g, "");
  if (t.startsWith("00")) t = "+" + t.slice(2);
  if (!t.startsWith("+")) t = "+" + t;
  return t;
};

const detectColType = (values: any[]): ColType => {
  const sample = values.filter((v) => !isBlank(v)).slice(0, 200);
  if (!sample.length) return "unknown";
  const score: Record<ColType, number> = {
    number: 0,
    text: 0,
    date: 0,
    email: 0,
    phone: 0,
    url: 0,
    boolean: 0,
    iban: 0,
    unknown: 0
  };
  for (const v of sample) {
    const s = String(v).trim();
    if (reEmail.test(s)) score.email++;
    if (reURL.test(s)) score.url++;
    if (rePhone.test(s)) score.phone++;
    if (reIBAN.test(s)) score.iban++;
    if (!isNaN(asNumber(s))) score.number++;
    if (!isNaN(new Date(s).getTime())) score.date++;
    if (["true", "false", "0", "1", "yes", "no"].includes(s.toLowerCase()))
      score.boolean++;
  }
  const priority: ColType[] = [
    "number",
    "date",
    "email",
    "phone",
    "url",
    "boolean",
    "iban",
    "text"
  ];
  const ranked = Object.entries(score)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k as ColType);
  for (const p of priority) if (ranked.includes(p)) return p;
  return "text";
};
const validateByType = (type: ColType, v: any) => {
  if (isBlank(v)) return true;
  const s = String(v).trim();
  switch (type) {
    case "number":
      return Number.isFinite(asNumber(s));
    case "date":
      return !isNaN(new Date(s).getTime());
    case "email":
      return reEmail.test(s);
    case "phone":
      return rePhone.test(s);
    case "url":
      return reURL.test(s);
    case "boolean":
      return ["true", "false", "0", "1", "yes", "no"].includes(s.toLowerCase());
    case "iban":
      return reIBAN.test(s);
    default:
      return true;
  }
};
const metricsFor = (rows: Row[], columns: string[]): ColMetrics[] => {
  if (!rows.length) return [];
  return columns.map((name) => {
    const col = rows.map((r) => r[name]);
    const type = detectColType(col);
    const n = col.length;
    const missing = col.filter((v) => isBlank(v)).length;
    const invalid = col.filter((v) => !validateByType(type, v)).length;
    const uniques = new Set(col.map((v) => (v ?? "__NULL__"))).size;
    const duplicates = Math.max(0, n - uniques);
    const missingPct = (missing / n) * 100;
    const invalidPct = (invalid / n) * 100;
    const duplicatesPct = (duplicates / n) * 100;
    const penalty = (missingPct + invalidPct + duplicatesPct / 2) / 2;
    const quality = Math.max(0, 100 - penalty);
    return { name, type, missingPct, duplicatesPct, invalidPct, quality };
  });
};

const toCSV = (rows: Row[], headers: string[]) => {
  const esc = (s: any) => {
    if (s === null || s === undefined) return "";
    const str = String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
};

/* CSV parser rapide (MVP) */
const parseCSV = async (file: File): Promise<Row[]> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const text = String(fr.result ?? "");
      const lines = text.replace(/\r/g, "").split("\n");
      if (!lines.length) return resolve([]);
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows: Row[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        const row: Row = {};
        const cells: string[] = [];
        let buf = "";
        let quote = false;
        for (const ch of lines[i]) {
          if (ch === '"') quote = !quote;
          else if (ch === "," && !quote) {
            cells.push(buf);
            buf = "";
          } else buf += ch;
        }
        cells.push(buf);
        headers.forEach(
          (h, j) => (row[h] = (cells[j] ?? "").replace(/^"|"$/g, ""))
        );
        rows.push(row);
      }
      resolve(rows);
    };
    fr.readAsText(file);
  });

/* Excel via CDN */
const loadXLSX = async () => {
  if ((window as any).XLSX) return (window as any).XLSX;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src =
      "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("XLSX CDN load failed"));
    document.body.appendChild(s);
  });
  return (window as any).XLSX;
};
const readExcel = async (
  file: File
): Promise<{ rows: Row[]; sheetNames: string[]; workbook: any; firstSheet: string }> => {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetNames = wb.SheetNames || [];
  const first = sheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: "" });
  return { rows, sheetNames, workbook: wb, firstSheet: first };
};

/* Demo dataset */
const demoRows: Row[] = [
  { id: 1, email: "JOHN..doe@example.com", phone: " (202) 555-0111", birth: "2024/01/32", city: "  Paris ", age: 34 },
  { id: 1, email: "john.doe@example.com", phone: "+1(202)5550111", birth: "2023-12-01", city: "Paris", age: 34 },
  { id: 2, email: "bad-email@", phone: "0033 6 12 34 56 78", birth: "2019-05-06", city: "Lyon", age: "" },
  { id: 3, email: "alice@example.com", phone: "06 12 34 56 78", birth: "2018-04-01", city: "Marseille", age: 29 },
  { id: 4, email: "", phone: "", birth: "", city: "Toulouse", age: 41 }
];

/* ======================================================
   Main component
====================================================== */
export default function App() {
  const { lang, t, toggle } = useI18n();

  type Tab = "analyze" | "stats" | "schedule" | "jobs";
  const [tab, setTab] = useState<Tab>("analyze");

  // Data states
  const [raw, setRaw] = useState<Row[]>([]);
  const [data, setData] = useState<Row[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<ColMetrics[]>([]);
  const [score, setScore] = useState<number>(0);

  // Excel multi-sheets
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [excelSelected, setExcelSelected] = useState<string>("");
  const [excelWb, setExcelWb] = useState<any | null>(null);

  // Actions per column
  const [actions, setActions] = useState<Record<string, ColumnAction>>({});

  // Logs dynamiques
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Schedules / Jobs (local persistence)
  const [schedules, setSchedules] = useState<Schedule[]>(
    () => JSON.parse(localStorage.getItem("schedules") || "[]") as Schedule[]
  );
  const [jobs, setJobs] = useState<Job[]>(
    () => JSON.parse(localStorage.getItem("jobs") || "[]") as Job[]
  );
  useEffect(() => localStorage.setItem("schedules", JSON.stringify(schedules)), [schedules]);
  useEffect(() => localStorage.setItem("jobs", JSON.stringify(jobs)), [jobs]);

  // UI misc
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"before" | "after">("before");

  // ---- helpers ----
  const renderLog = (l: LogEntry) => {
    if (l.k === "log_loaded") return t("log_loaded", { name: l.name });
    if (l.k === "log_dedupe") return t("log_dedupe", { col: l.col, n: l.n });
    if (l.k === "log_impute_mean")
      return t("log_impute_mean", { col: l.col, v: l.v });
    if (l.k === "log_impute_mode")
      return t("log_impute_mode", { col: l.col, v: l.v });
    if (l.k === "log_standardize") return t("log_standardize", { col: l.col });
    if (l.k === "log_applied") return t("log_applied");
    return "";
  };

  const analyze = (rows: Row[], label?: string) => {
    const limited = rows.slice(0, 1000);
    const headers = Object.keys(limited[0] || {});
    const m = metricsFor(limited, headers);
    const avg = m.length ? m.reduce((s, c) => s + c.quality, 0) / m.length : 0;
    const defaults: Record<string, ColumnAction> = {};
    m.forEach((c) => {
      defaults[c.name] = {
        dedupe: c.duplicatesPct > 0,
        impute: c.missingPct > 0 ? (c.type === "number" ? "mean" : "mode") : "none",
        standardize: ["email", "phone", "date", "url", "text"].includes(c.type),
        decision: "pending"
      };
    });
    setRaw(limited);
    setData(limited);
    setCols(headers);
    setMetrics(m);
    setScore(Math.round(avg));
    setActions(defaults);
    if (label) setLogs((L) => [{ k: "log_loaded", name: label }, ...L]);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    setBusy(t("analyze_progress"));
    try {
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        const { rows, sheetNames, workbook, firstSheet } = await readExcel(f);
        setExcelWb(workbook);
        setExcelSheets(sheetNames);
        setExcelSelected(firstSheet);
        analyze(rows, f.name);
      } else if (/\.(csv|txt)$/i.test(f.name)) {
        const rows = await parseCSV(f);
        setExcelWb(null);
        setExcelSheets([]);
        setExcelSelected("");
        analyze(rows, f.name);
      } else if (/\.(json)$/i.test(f.name)) {
        const text = await f.text();
        const v = JSON.parse(text);
        const rows = Array.isArray(v) ? v : [v];
        setExcelWb(null);
        setExcelSheets([]);
        setExcelSelected("");
        analyze(rows, f.name);
      } else {
        const rows = await parseCSV(f as any);
        setExcelWb(null);
        setExcelSheets([]);
        setExcelSelected("");
        analyze(rows, f.name);
      }
    } catch (e: any) {
      alert(e?.message || "Upload error");
    } finally {
      setBusy(null);
    }
  };

  const switchExcelSheet = (name: string) => {
    if (!excelWb) return;
    const XLSX = (window as any).XLSX;
    const rows = XLSX.utils.sheet_to_json(excelWb.Sheets[name], { defval: "" });
    analyze(rows, `${t("sheet")} ${name}`);
    setExcelSelected(name);
  };

  const problemCols = metrics.filter(
    (m) => m.missingPct > 0 || m.invalidPct > 0 || m.duplicatesPct > 0
  );

  const setAction = (col: string, patch: Partial<ColumnAction>) =>
    setActions((a) => ({ ...a, [col]: { ...(a[col] || { dedupe: false, impute: "none", standardize: false, decision: "pending" }), ...patch } }));

  // Apply ONLY accepted columns
  const applyAccepted = () => {
    if (!data.length) return;
    let rows = [...data];
    const newLogs: LogEntry[] = [];
    for (const c of cols) {
      const act = actions[c];
      if (!act || act.decision !== "accept") continue;

      // dedupe
      if (act.dedupe) {
        const seen = new Set<string>();
        const unique: Row[] = [];
        for (const r of rows) {
          const key = String(r[c] ?? "__NULL__");
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(r);
          }
        }
        const removed = rows.length - unique.length;
        if (removed > 0) newLogs.push({ k: "log_dedupe", col: c, n: removed });
        rows = unique;
      }

      // imputation
      if (act.impute !== "none") {
        if (act.impute === "mean") {
          const nums = rows.map((r) => asNumber(r[c])).filter((n) => Number.isFinite(n));
          const m = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : NaN;
          if (Number.isFinite(m)) {
            rows = rows.map((r) => (isBlank(r[c]) ? { ...r, [c]: m } : r));
            newLogs.push({ k: "log_impute_mean", col: c, v: Number(m.toFixed(2)) });
          }
        } else if (act.impute === "mode") {
          const freq = new Map<string, number>();
          for (const r of rows) {
            const k = String(r[c] ?? "");
            if (!k) continue;
            freq.set(k, (freq.get(k) || 0) + 1);
          }
          const best = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
          if (best !== undefined) {
            rows = rows.map((r) => (isBlank(r[c]) ? { ...r, [c]: best } : r));
            newLogs.push({ k: "log_impute_mode", col: c, v: best });
          }
        }
      }

      // standardize
      if (act.standardize) {
        const type = metrics.find((m) => m.name === c)?.type ?? "text";
        rows = rows.map((r) => {
          const v = r[c];
          if (isBlank(v)) return r;
          let nv = v;
          switch (type) {
            case "email":
              nv = String(v).trim().toLowerCase();
              break;
            case "date":
              nv = toISODate(v) ?? v;
              break;
            case "phone":
              nv = standardizePhone(v);
              break;
            case "url":
              nv = String(v).trim().toLowerCase();
              break;
            default:
              nv = normalizeText(v);
          }
          return nv === v ? r : { ...r, [c]: nv };
        });
        newLogs.push({ k: "log_standardize", col: c });
      }
    }

    // Recompute metrics & score
    const m = metricsFor(rows, cols);
    const avg = m.length ? m.reduce((s, c) => s + c.quality, 0) / m.length : 0;
    setData(rows);
    setMetrics(m);
    setScore(Math.round(avg));
    setLogs((L) => [{ k: "log_applied" }, ...newLogs, ...L]);
    alert(t("apply_all_ok"));
    setPreviewMode("after");
  };

  const acceptAll = () =>
    setActions((a) => {
      const n: typeof a = {};
      for (const k of Object.keys(a)) n[k] = { ...a[k], decision: "accept" };
      return n;
    });

  const resetAll = () => {
    setRaw([]);
    setData([]);
    setCols([]);
    setMetrics([]);
    setScore(0);
    setActions({});
    setLogs([]);
    setExcelSheets([]);
    setExcelSelected("");
    setExcelWb(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    alert(t("reset_ok"));
  };

  // Stats text (remplace les charts)
  const numericCols = useMemo(
    () => metrics.filter((m) => m.type === "number").map((m) => m.name),
    [metrics]
  );
  const statsText = useMemo(() => {
    if (!data.length) return [];
    const S: { name: string; mean: number; median: number; std: number; missingPct: number }[] = [];
    for (const c of numericCols) {
      const arr = data.map((r) => asNumber(r[c]));
      const val = arr.filter((n) => Number.isFinite(n));
      const missPct = (1 - val.length / arr.length) * 100;
      S.push({
        name: c,
        mean: val.length ? val.reduce((s, n) => s + n, 0) / val.length : NaN,
        median: median(val),
        std: stddev(val),
        missingPct: missPct
      });
    }
    return S.slice(0, 6);
  }, [data, numericCols]);

  const interpretations = useMemo(() => {
    if (!metrics.length) return [];
    const out: string[] = [];
    for (const m of metrics) {
      if (m.missingPct > 20)
        out.push(
          lang === "fr"
            ? `⚠️ ${m.name}: ${Math.round(m.missingPct)}% manquants — imputation recommandée`
            : `⚠️ ${m.name}: ${Math.round(m.missingPct)}% missing — imputation recommended`
        );
      if (m.invalidPct > 5)
        out.push(
          lang === "fr"
            ? `🚫 ${m.name}: ${Math.round(m.invalidPct)}% invalides — standardiser/valider`
            : `🚫 ${m.name}: ${Math.round(m.invalidPct)}% invalid — standardize/validate`
        );
      if (m.duplicatesPct > 0)
        out.push(
          lang === "fr"
            ? `🔁 ${m.name}: ${Math.round(m.duplicatesPct)}% doublons — dédoublonnage conseillé`
            : `🔁 ${m.name}: ${Math.round(m.duplicatesPct)}% duplicates — dedupe advised`
        );
    }
    if (!out.length)
      out.push(lang === "fr" ? "👌 Données propres." : "👌 Data looks clean.");
    return out.slice(0, 6);
  }, [metrics, lang]);

  // Planifier
  const [newJob, setNewJob] = useState<Schedule>({
    id: cryptoRandom(),
    name: "",
    freq: "daily",
    time: "09:00",
    source: "current",
    createdAt: Date.now()
  });

  const addSchedule = () => {
    if (!newJob.name.trim()) return alert("Job name missing");
    const j = { ...newJob, id: cryptoRandom(), createdAt: Date.now() };
    setSchedules((s) => [j, ...s]);
    setNewJob({
      id: cryptoRandom(),
      name: "",
      freq: "daily",
      time: "09:00",
      source: "current",
      createdAt: Date.now()
    });
  };

  const dryRun = (id: string) => {
    const sc = schedules.find((s) => s.id === id);
    if (!sc) return;
    const input = sc.source === "demo" ? demoRows : data.length ? data : demoRows;
    const m = metricsFor(input, Object.keys(input[0] || {}));
    const defaultScore = Math.round(
      m.length ? m.reduce((s, c) => s + c.quality, 0) / m.length : 0
    );
    // simulate improvement
    const improved = Math.min(100, defaultScore + 8);
    setJobs((J) => [
      {
        id: cryptoRandom(),
        name: sc.name + " (dry-run)",
        status: "completed",
        at: Date.now(),
        fromScore: defaultScore,
        toScore: improved
      },
      ...J
    ]);
    setSchedules((SS) =>
      SS.map((s) =>
        s.id === id
          ? {
              ...s,
              lastDryRun: Date.now(),
              nextRunISO: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
            }
          : s
      )
    );
  };

  const runNow = (id: string) => {
    const sc = schedules.find((s) => s.id === id);
    if (!sc) return;
    const input = sc.source === "demo" ? demoRows : data.length ? data : demoRows;
    const headers = Object.keys(input[0] || {});
    const m = metricsFor(input, headers);
    const from = Math.round(m.reduce((s, c) => s + c.quality, 0) / m.length || 0);

    // auto-apply simple rules
    const defaults: Record<string, ColumnAction> = {};
    m.forEach((c) => {
      defaults[c.name] = {
        dedupe: c.duplicatesPct > 0,
        impute: c.missingPct > 0 ? (c.type === "number" ? "mean" : "mode") : "none",
        standardize: ["email", "phone", "date", "url", "text"].includes(c.type),
        decision: "accept"
      };
    });
    const out = applyProgrammatic(input, headers, m, defaults);
    const m2 = metricsFor(out, headers);
    const to = Math.round(m2.reduce((s, c) => s + c.quality, 0) / m2.length || 0);

    const csv = toCSV(out, headers);
    const key = `jobcsv_${cryptoRandom()}`;
    localStorage.setItem(key, csv);

    const job: Job = {
      id: cryptoRandom(),
      name: sc.name,
      status: "completed",
      at: Date.now(),
      fromScore: from,
      toScore: to,
      resultKey: key
    };
    setJobs((J) => [job, ...J]);
  };

  const deleteSchedule = (id: string) =>
    setSchedules((S) => S.filter((s) => s.id !== id));

  const downloadICS = (s: Schedule) => {
    const [H, M] = s.time.split(":").map((x) => x.padStart(2, "0"));
    const RRULE =
      s.freq === "daily"
        ? `FREQ=DAILY;BYHOUR=${H};BYMINUTE=${M};BYSECOND=0`
        : s.freq === "weekly"
        ? `FREQ=WEEKLY;BYHOUR=${H};BYMINUTE=${M};BYSECOND=0`
        : `FREQ=MONTHLY;BYHOUR=${H};BYMINUTE=${M};BYSECOND=0`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//DataClean AI//EN",
      "BEGIN:VEVENT",
      `UID:${cryptoRandom()}@dataclean`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `SUMMARY:${s.name}`,
      `RRULE:${RRULE}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${s.name}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadCleanCSV = () => {
    if (!data.length) return;
    const csv = toCSV(data, cols);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dataclean_cleaned.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadJobCSV = (j: Job) => {
    if (!j.resultKey) return;
    const csv = localStorage.getItem(j.resultKey);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${j.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // --- chat (MVP: appelle /api/openai si clé présente, sinon fallback local)
  async function ask(message: string) {
    addUser(message);
    addTyping(true);
    try {
      const res = await fetch("/api/openai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: message,
          context: { score, problems: problemCols.slice(0, 5), columns: cols }
        })
      }).catch(() => null);

      let txt = "";
      if (res && res.ok) {
        const j = await res.json();
        txt = j?.reply || "";
      }
      if (!txt) {
        const low = message.toLowerCase();
        if (low.includes("doublon"))
          txt =
            lang === "fr"
              ? "Je propose un dédoublonnage sur les colonnes avec >0% de doublons."
              : "I suggest deduplication on columns with >0% duplicates.";
        else if (low.includes("validation"))
          txt =
            lang === "fr"
              ? "Règles recommandées : email RFC, dates ISO-8601, téléphones E.164, trim accents."
              : "Recommended rules: RFC email, ISO-8601 dates, E.164 phones, trim accents.";
        else
          txt =
            lang === "fr"
              ? "Je peux normaliser les dates en ISO 8601 et formater les téléphones en E.164."
              : "I can normalize dates to ISO-8601 and format phones to E.164.";
      }
      addAI(txt);
    } catch {
      addAI(lang === "fr" ? "Erreur réseau." : "Network error.");
    } finally {
      addTyping(false);
    }
  }
  // tiny chat dom helpers
  function addUser(text: string) {
    const wrap = document.getElementById("chat");
    if (!wrap) return;
    const row = document.createElement("div");
    row.style.display = "flex"; row.style.gap = "8px"; row.style.flexDirection = "row-reverse";
    const avatar = document.createElement("div");
    avatar.style.width = "28px"; avatar.style.height = "28px"; avatar.style.borderRadius = "999px";
    avatar.style.background = "#4a90e2"; avatar.style.display = "grid"; avatar.style.placeItems = "center";
    avatar.textContent = "👤";
    const bubble = document.createElement("div");
    bubble.style.background = "#4a90e2"; bubble.style.padding = "8px 10px"; bubble.style.borderRadius = "10px";
    bubble.style.maxWidth = "240px"; bubble.style.fontSize = "13px"; bubble.textContent = text;
    row.appendChild(avatar); row.appendChild(bubble); wrap.appendChild(row); wrap.scrollTop = wrap.scrollHeight;
  }
  function addAI(text: string) {
    const wrap = document.getElementById("chat");
    if (!wrap) return;
    const row = document.createElement("div");
    row.style.display = "flex"; row.style.gap = "8px";
    const avatar = document.createElement("div");
    avatar.style.width = "28px"; avatar.style.height = "28px"; avatar.style.borderRadius = "999px";
    avatar.style.background = "linear-gradient(135deg,#8b5cf6,#a855f7)"; avatar.style.display = "grid"; avatar.style.placeItems = "center";
    avatar.textContent = "🤖";
    const bubble = document.createElement("div");
    bubble.style.background = "rgba(255,255,255,0.08)"; bubble.style.padding = "8px 10px"; bubble.style.borderRadius = "10px";
    bubble.style.maxWidth = "240px"; bubble.style.fontSize = "13px"; bubble.textContent = text;
    row.appendChild(avatar); row.appendChild(bubble); wrap.appendChild(row); wrap.scrollTop = wrap.scrollHeight;
  }
  function addTyping(on: boolean) {
    const wrap = document.getElementById("chat");
    if (!wrap) return;
    const id = "typing";
    const ex = document.getElementById(id);
    if (ex) ex.remove();
    if (!on) return;
    const row = document.createElement("div");
    row.id = id; row.style.opacity = "0.75"; row.style.fontSize = "12px";
    row.textContent = `⋯ ${t("ai_thinking")} ⋯`;
    wrap.appendChild(row); wrap.scrollTop = wrap.scrollHeight;
  }

  // ----------------------------------------------------
  return (
    <div style={{ background: "#0f1222", color: "#fff", minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#4a90e2", display: "grid", placeItems: "center", fontSize: 18 }}>📊</div>
            <div>
              <div style={{ fontWeight: 700 }}>{t("app_title")}</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>{t("subtitle")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => {
                toggle();
                setLogs((L) => [{ k: "log_applied" }, ...L]); // petit ping visuel
              }}
              style={{ ...badge, padding: "6px 10px", cursor: "pointer", background: "rgba(255,255,255,0.08)" }}
            >
              🌐 {lang.toUpperCase()}
            </button>
            <a href="#" style={{ ...badge, background: "#ff8c00" }}>👑 {t("pro")}</a>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <nav style={{ display: "flex", gap: 0, maxWidth: 1400, margin: "0 auto", padding: "0 24px" }}>
            {[
              { id: "analyze", label: t("nav_analyze") },
              { id: "stats", label: t("nav_stats") },
              { id: "schedule", label: t("nav_schedule") },
              { id: "jobs", label: t("nav_jobs") }
            ].map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id as Tab)}
                style={{
                  padding: "14px 18px",
                  background: tab === (n.id as Tab) ? "rgba(74,144,226,0.07)" : "transparent",
                  color: tab === (n.id as Tab) ? "#4a90e2" : "rgba(255,255,255,0.85)",
                  border: "none",
                  borderBottom: `3px solid ${tab === (n.id as Tab) ? "#4a90e2" : "transparent"}`,
                  cursor: "pointer",
                  fontWeight: 700
                }}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Layout */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24, display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        {/* Main */}
        <main style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20, minHeight: 560 }}>
          {/* Analyze */}
          {tab === "analyze" && (
            <div>
              {/* Upload */}
              <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed rgba(255,255,255,0.35)", borderRadius: 12, padding: "44px 24px", textAlign: "center", background: "rgba(255,255,255,0.02)", cursor: "pointer" }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, background: "#4a90e2", display: "grid", placeItems: "center", margin: "0 auto 16px", fontSize: 24 }}>📤</div>
                <h2 style={{ fontSize: 20, marginBottom: 6 }}>{t("drop_title")}</h2>
                <p style={{ opacity: 0.8, marginBottom: 14 }}>{t("drop_sub")}</p>
                <div style={{ display: "flex", gap: 18, justifyContent: "center", opacity: 0.85, fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#4ade80" }}></span>{t("size_ok")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#4a90e2" }}></span>{t("free_limit")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#a855f7" }}></span>{t("privacy")}</div>
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.json,.txt" multiple style={{ display: "none" }} onChange={(e) => onFiles(e.target.files)} />
                {busy && <div style={{ marginTop: 12, opacity: 0.9 }}>{busy}</div>}
              </div>

              {/* Excel sheet selector */}
              {!!excelSheets.length && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                  <strong>{t("sheet")}:</strong>
                  <select value={excelSelected} onChange={(e) => switchExcelSheet(e.target.value)} style={{ ...darkInput, padding: "8px 10px" }}>
                    {excelSheets.map((s) => (
                      <option key={s} value={s} style={{ background: "#202433" }}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginTop: 18 }}>
                <KPI value={`${score}%`} label={t("score_title")} color={score >= 80 ? "#4ade80" : score >= 60 ? "#eab308" : "#f97316"} />
                <KPI value={`${data.length}`} label={t("rows_analyzed")} />
                <KPI value={`${cols.length}`} label={t("cols_found")} />
                <KPI value={`${problemCols.length}`} label={t("issues_found")} />
              </div>

              {/* Preview before/after */}
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 18 }}>👀 {t("preview_title")}</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setPreviewMode("before")} style={{ ...badge, padding: "6px 10px", cursor: "pointer", background: previewMode === "before" ? "#334155" : "rgba(255,255,255,0.06)" }}>
                      {t("before")}
                    </button>
                    <button onClick={() => setPreviewMode("after")} style={{ ...badge, padding: "6px 10px", cursor: "pointer", background: previewMode === "after" ? "#334155" : "rgba(255,255,255,0.06)" }}>
                      {t("after")}
                    </button>
                  </div>
                </div>
                <PreviewTable rows={previewMode === "before" ? raw : data} cols={cols} />
              </div>

              {/* Columns with issues */}
              <div style={{ marginTop: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 20 }}>{t("problems_cols")}</h3>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={acceptAll} disabled={!problemCols.length} style={{ ...badge, padding: "8px 12px", cursor: "pointer", background: "#0ea5e9" }}>
                      ✅ {t("accept_all")}
                    </button>
                    <button onClick={applyAccepted} disabled={!problemCols.length} style={{ ...badge, padding: "8px 12px", cursor: "pointer", background: "#2563eb" }}>
                      ⚡ {t("apply_selected")}
                    </button>
                    <button onClick={downloadCleanCSV} disabled={!data.length} style={{ ...badge, padding: "8px 12px", cursor: "pointer", background: "rgba(255,255,255,0.08)" }}>
                      ⬇ {t("download_csv")}
                    </button>
                    <button onClick={resetAll} style={{ ...badge, padding: "8px 12px", cursor: "pointer", background: "rgba(239,68,68,0.25)", borderColor: "rgba(239,68,68,0.4)" }}>
                      ♻ {t("reset")}
                    </button>
                  </div>
                </div>
                <div style={{ opacity: 0.7, marginBottom: 8, fontSize: 13 }}>{t("only_problem_cols")}</div>

                {!problemCols.length ? (
                  <div style={{ opacity: 0.75, padding: 10 }}>{t("no_data_yet")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {problemCols.map((c) => {
                      const a = actions[c.name];
                      const suggested: string[] = [];
                      if (c.duplicatesPct > 0) suggested.push(t("prop_dedupe"));
                      if (c.missingPct > 0)
                        suggested.push(
                          c.type === "number" ? t("prop_impute_mean") : t("prop_impute_mode")
                        );
                      if (["email", "phone", "date", "url", "text"].includes(c.type))
                        suggested.push(t("prop_standardize"));

                      return (
                        <div key={c.name} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 17 }}>{c.name}</strong>
                              <span style={badge}>{t("type")}: {c.type}</span>
                              <span style={badge}>{t("quality")}: {Math.round(c.quality)}%</span>
                              <span style={badge}>{t("missing")}: {Math.round(c.missingPct)}%</span>
                              <span style={badge}>dup: {Math.round(c.duplicatesPct)}%</span>
                              <span style={badge}>inv: {Math.round(c.invalidPct)}%</span>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ opacity: 0.85, fontSize: 13 }}>{t("proposal")}:</span>
                              <span style={{ ...badge, background: "rgba(74,144,226,0.12)", borderColor: "rgba(74,144,226,0.35)", color: "#9cc3ff" }}>
                                {suggested.join(" · ") || (lang === "fr" ? "Aucune" : "None")}
                              </span>
                              <button onClick={() => setAction(c.name, { decision: "accept" })} style={{ ...badge, padding: "6px 10px", cursor: "pointer", background: a?.decision === "accept" ? "#16a34a" : "rgba(255,255,255,0.06)" }}>
                                {t("accept")}
                              </button>
                              <button onClick={() => setAction(c.name, { decision: "reject" })} style={{ ...badge, padding: "6px 10px", cursor: "pointer", background: a?.decision === "reject" ? "#ef4444" : "rgba(255,255,255,0.06)" }}>
                                {t("reject")}
                              </button>
                            </div>
                          </div>

                          {/* action toggles */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginTop: 10 }}>
                            <label style={cardLabel}>
                              <input type="checkbox" checked={!!a?.dedupe} onChange={(e) => setAction(c.name, { dedupe: e.target.checked })} />
                              {t("prop_dedupe")}
                            </label>
                            <div style={cardLabel}>
                              <span>{lang === "fr" ? "Imputation" : "Imputation"}:</span>
                              <select value={a?.impute ?? "none"} onChange={(e) => setAction(c.name, { impute: e.target.value as any })} style={{ ...darkInput, padding: "8px 10px", width: "100%" }}>
                                <option value="none" style={{ background: "#202433" }}>{lang === "fr" ? "Aucune" : "None"}</option>
                                <option value="mean" style={{ background: "#202433" }}>{t("prop_impute_mean")}</option>
                                <option value="mode" style={{ background: "#202433" }}>{t("prop_impute_mode")}</option>
                              </select>
                            </div>
                            <label style={cardLabel}>
                              <input type="checkbox" checked={!!a?.standardize} onChange={(e) => setAction(c.name, { standardize: e.target.checked })} />
                              {t("prop_standardize")}
                            </label>
                            <div />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          {tab === "stats" && (
            <div>
              <h2 style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 10 }}>
                📈 {t("stats_title")}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                <div style={panel}>
                  <strong>{t("stats_missing_by_col")}</strong>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {metrics.slice(0, 10).map((m) => (
                      <div key={m.name} style={rowStat}>
                        <span>{m.name}</span>
                        <span>{Math.round(m.missingPct)}% {t("missing")}</span>
                      </div>
                    ))}
                    {!metrics.length && <div style={{ opacity: 0.7 }}>{t("no_data_yet")}</div>}
                  </div>
                </div>

                <div style={panel}>
                  <strong>{t("stats_synth")}</strong>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {statsText.map((s) => (
                      <div key={s.name} style={{ background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: 10 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.name}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, fontSize: 14 }}>
                          <div>{t("mean")}: <b>{Number.isFinite(s.mean) ? s.mean.toFixed(2) : "-"}</b></div>
                          <div>{t("median")}: <b>{Number.isFinite(s.median) ? s.median.toFixed(2) : "-"}</b></div>
                          <div>{t("std")}: <b>{Number.isFinite(s.std) ? s.std.toFixed(2) : "-"}</b></div>
                          <div>{t("missing")}: <b>{Math.round(s.missingPct)}%</b></div>
                        </div>
                      </div>
                    ))}
                    {!statsText.length && <div style={{ opacity: 0.7 }}>{t("no_data_yet")}</div>}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <strong>{t("interpretation")}</strong>
                    <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.6 }}>
                      {interpretations.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Schedule */}
          {tab === "schedule" && (
            <div>
              <h2 style={{ fontSize: 22 }}>📅 {t("schedule_title")}</h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginTop: 12 }}>
                <input placeholder={t("job_name")} value={newJob.name} onChange={(e) => setNewJob((j) => ({ ...j, name: e.target.value }))} style={darkInput} />
                <select value={newJob.freq} onChange={(e) => setNewJob((j) => ({ ...j, freq: e.target.value as any }))} style={darkInput}>
                  <option value="daily" style={{ background: "#202433" }}>{t("freq_daily")}</option>
                  <option value="weekly" style={{ background: "#202433" }}>{t("freq_weekly")}</option>
                  <option value="monthly" style={{ background: "#202433" }}>{t("freq_monthly")}</option>
                </select>
                <input type="time" value={newJob.time} onChange={(e) => setNewJob((j) => ({ ...j, time: e.target.value }))} style={darkInput} />
                <select value={newJob.source} onChange={(e) => setNewJob((j) => ({ ...j, source: e.target.value as any }))} style={darkInput}>
                  <option value="current" style={{ background: "#202433" }}>{t("src_current")}</option>
                  <option value="demo" style={{ background: "#202433" }}>{t("src_demo")}</option>
                </select>
              </div>

              <div style={{ marginTop: 10 }}>
                <button onClick={addSchedule} style={{ ...badge, padding: "10px 12px", cursor: "pointer", background: "#2563eb" }}>
                  ➕ {t("create_job")}
                </button>
              </div>

              <h3 style={{ marginTop: 18 }}>{t("schedules")}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {!schedules.length && <div style={{ opacity: 0.7 }}>{t("no_data_yet")}</div>}
                {schedules.map((s) => (
                  <div key={s.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 1.2fr auto", gap: 10 }}>
                    <div><b>{s.name}</b></div>
                    <div>{t("frequency")}: {s.freq}</div>
                    <div>{t("run_time")}: {s.time}</div>
                    <div>{t("next_run")}: {s.nextRunISO ? new Date(s.nextRunISO).toLocaleString() : "-"}</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => dryRun(s.id)} style={{ ...badge, padding: "8px 10px", cursor: "pointer", background: "rgba(255,255,255,0.08)" }}>▶ {t("dry_run")}</button>
                      <button onClick={() => runNow(s.id)} style={{ ...badge, padding: "8px 10px", cursor: "pointer", background: "#16a34a" }}>⚡ {t("run_now")}</button>
                      <button onClick={() => downloadICS(s)} style={{ ...badge, padding: "8px 10px", cursor: "pointer", background: "#334155" }}>📅 {t("download_ics")}</button>
                      <button onClick={() => deleteSchedule(s.id)} style={{ ...badge, padding: "8px 10px", cursor: "pointer", background: "#7f1d1d" }}>🗑 {t("delete")}</button>
                    </div>
                    <div style={{ gridColumn: "1/-1", opacity: 0.8 }}>{t("last_dryrun")}: {s.lastDryRun ? new Date(s.lastDryRun).toLocaleString() : "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Jobs */}
          {tab === "jobs" && (
            <div>
              <h2 style={{ fontSize: 22 }}>⚙️ {t("jobs_title")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {!jobs.length && <div style={{ opacity: 0.7 }}>{t("no_data_yet")}</div>}
                {jobs.map((j) => (
                  <div key={j.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10 }}>
                    <div><b>{j.name}</b></div>
                    <div>{t("status")}: {t(j.status)}</div>
                    <div>{new Date(j.at).toLocaleString()}</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      {typeof j.fromScore === "number" && typeof j.toScore === "number" && (
                        <span style={{ ...badge, background: "rgba(74,144,226,0.12)", borderColor: "rgba(74,144,226,0.35)", color: "#9cc3ff" }}>
                          {t("improved_from_to", { a: j.fromScore, b: j.toScore })}
                        </span>
                      )}
                      {j.resultKey && (
                        <button onClick={() => downloadJobCSV(j)} style={{ ...badge, padding: "6px 10px", cursor: "pointer", background: "rgba(255,255,255,0.08)" }}>
                          ⬇ {t("download_result")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Assistant */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, overflow: "hidden", height: 540, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#8b5cf6,#a855f7)", display: "grid", placeItems: "center" }}>🤖</div>
              <div>
                <div style={{ fontWeight: 700 }}>{t("assistant")}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{t("expert")}</div>
              </div>
            </div>
            <div id="chat" style={{ padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: "linear-gradient(135deg,#8b5cf6,#a855f7)", display: "grid", placeItems: "center" }}>🤖</div>
                <div style={{ background: "rgba(255,255,255,0.08)", padding: "8px 10px", borderRadius: 10, maxWidth: 240, fontSize: 13 }}>
                  {lang === "fr" ? "Salut ! Je suis votre assistant IA. Uploadez un fichier et je vous aiderai." : "Hi! I’m your AI assistant. Upload a file and I’ll help you."}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {[ "Quels sont les doublons détectés ?", "Recommande-moi des règles de validation", "Explique-moi ces anomalies" ].map((q) => (
                  <button key={q} onClick={() => ask(lang === "fr" ? q : translatePreset(q))} style={{ textAlign: "left", background: "rgba(74,144,226,0.12)", border: "1px solid rgba(74,144,226,0.35)", color: "#9cc3ff", padding: "6px 8px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
                    {lang === "fr" ? q : translatePreset(q)}
                  </button>
                ))}
              </div>
            </div>
            <ChatInput onSend={(m) => ask(m)} placeholder={t("ask_placeholder")} />
          </div>

          {/* Logs */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 12, minHeight: 140 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>🗒 Logs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, maxHeight: 180, overflowY: "auto" }}>
              {!logs.length && <div style={{ opacity: 0.7 }}>{t("no_data_yet")}</div>}
              {logs.map((l, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: "6px 8px", borderRadius: 8 }}>
                  {renderLog(l)}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Demo footer action for quick test */}
      {!raw.length && (
        <div style={{ textAlign: "center", padding: 10, opacity: 0.8 }}>
          <button
            onClick={() => analyze(demoRows, "Demo")}
            style={{ ...badge, padding: "10px 14px", cursor: "pointer", background: "#0ea5e9" }}
          >
            🚀 Charger le dataset démo
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- UI helpers ---------- */
function KPI({ value, label, color = "#e5e7eb" }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ opacity: 0.8 }}>{label}</div>
    </div>
  );
}
function PreviewTable({ rows, cols }: { rows: Row[]; cols: string[] }) {
  if (!rows.length) return <div style={{ opacity: 0.7 }}>—</div>;
  const head = cols.length ? cols : Object.keys(rows[0] || {});
  return (
    <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 10px", background: "rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((r, i) => (
            <tr key={i}>
              {head.map((h) => (
                <td key={h} style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {String(r[h] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const panel: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 };
const rowStat: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 14, background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: 8 };

/* Simple card-like label */
const cardLabel: React.CSSProperties = {
  display: "flex", gap: 8, alignItems: "center",
  background: "rgba(255,255,255,0.03)", padding: 10,
  borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)"
};

/* ---------- Chat subcomponent ---------- */
function ChatInput({ onSend, placeholder }: { onSend: (m: string) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (v.trim()) { onSend(v.trim()); setV(""); }
            }
          }}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1, resize: "none", background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.2)", color: "#fff",
            borderRadius: 10, padding: "10px 12px", fontFamily: "inherit"
          }}
        />
        <button
          onClick={() => { if (v.trim()) { onSend(v.trim()); setV(""); } }}
          style={{ width: 42, height: 42, borderRadius: 999, background: "#4a90e2", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700 }}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

/* ---------- Pure function used by Run now ---------- */
function applyProgrammatic(
  rows: Row[],
  cols: string[],
  metrics: ColMetrics[],
  actions: Record<string, ColumnAction>
) {
  let out = [...rows];
  for (const c of cols) {
    const a = actions[c];
    if (!a) continue;

    if (a.dedupe) {
      const seen = new Set<string>();
      const uniq: Row[] = [];
      for (const r of out) {
        const key = String(r[c] ?? "__NULL__");
        if (!seen.has(key)) { seen.add(key); uniq.push(r); }
      }
      out = uniq;
    }

    if (a.impute !== "none") {
      if (a.impute === "mean") {
        const nums = out.map((r) => asNumber(r[c])).filter((n) => Number.isFinite(n));
        const m = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : NaN;
        if (Number.isFinite(m)) out = out.map((r) => (isBlank(r[c]) ? { ...r, [c]: m } : r));
      } else {
        const freq = new Map<string, number>();
        for (const r of out) {
          const k = String(r[c] ?? "");
          if (!k) continue;
          freq.set(k, (freq.get(k) || 0) + 1);
        }
        const best = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (best !== undefined) out = out.map((r) => (isBlank(r[c]) ? { ...r, [c]: best } : r));
      }
    }

    if (a.standardize) {
      const type = metrics.find((m) => m.name === c)?.type ?? "text";
      out = out.map((r) => {
        const v = r[c];
        if (isBlank(v)) return r;
        let nv = v;
        switch (type) {
          case "email": nv = String(v).trim().toLowerCase(); break;
          case "date": nv = toISODate(v) ?? v; break;
          case "phone": nv = standardizePhone(v); break;
          case "url": nv = String(v).trim().toLowerCase(); break;
          default: nv = normalizeText(v);
        }
        return nv === v ? r : { ...r, [c]: nv };
      });
    }
  }
  return out;
}

/* ---------- small utils ---------- */
function cryptoRandom() {
  if ((window as any).crypto?.randomUUID) return (window as any).crypto.randomUUID();
  return "id_" + Math.random().toString(36).slice(2);
}
function toICSDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}
function translatePreset(fr: string) {
  switch (fr) {
    case "Quels sont les doublons détectés ?":
      return "What duplicates were detected?";
    case "Recommande-moi des règles de validation":
      return "Recommend validation rules";
    case "Explique-moi ces anomalies":
      return "Explain these anomalies";
    default:
      return fr;
  }
}
