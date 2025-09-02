import React, { useEffect, useMemo, useRef, useState } from "react";

/* -------------------------------------------------------
   🗣️  i18n – FR / EN
------------------------------------------------------- */
type Lang = "fr" | "en";
const dict: Record<Lang, Record<string, string>> = {
  fr: {
    app_title: "DataClean AI",
    subtitle: "Assistant IA pour nettoyage de données d'entreprise",
    pro: "Pro",
    nav_analyze: "Analyser",
    nav_stats: "Statistiques descriptives",
    nav_schedule: "Planifier",
    nav_jobs: "Jobs",
    drop_title: "Déposez vos fichiers ou cliquez ici",
    drop_sub: "CSV, Excel, JSON, TXT (≤ 50 Mo). Vos données restent dans votre navigateur.",
    size_ok: "Taille max : 50 Mo",
    free_limit: "Analyse gratuite : 1000 lignes",
    privacy: "Traitement local sécurisé",
    reset: "Réinitialiser",
    score_title: "Score global",
    rows_analyzed: "Lignes analysées",
    cols_found: "Colonnes trouvées",
    issues_found: "Problèmes détectés",
    problems_cols: "Colonnes avec problèmes",
    type: "type",
    quality: "Qualité",
    dedupe: "Supprimer doublons",
    impute: "Imputation",
    impute_none: "Aucune",
    impute_mean: "Moyenne (num.)",
    impute_mode: "Mode (cat.)",
    standardize: "Standardiser (format/texte)",
    keep_as_is: "Garder tel quel",
    apply_selected: "Appliquer la sélection",
    download_csv: "Télécharger CSV propre",
    fixes_log: "Corrections appliquées",
    stats_title: "Statistiques Descriptives",
    stats_missing_by_col: "Synthèse par colonne",
    stats_synth: "Synthèse générale",
    mean: "Moyenne",
    median: "Médiane",
    std: "Écart-type",
    missing: "Manquants",
    unique: "Uniques",
    interpretation: "Interprétation",
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
    next_run: "Prochaine exécution",
    last_dryrun: "Dernier dry-run",
    jobs_title: "Historique des jobs",
    status: "Statut",
    running: "en cours",
    completed: "terminé",
    failed: "échec",
    no_data_yet: "Aucune donnée à afficher pour l’instant.",
    assistant: "Assistant IA",
    expert: "Expert en nettoyage de données",
    ask_placeholder: "Posez votre question sur vos données…",
    send: "Envoyer",
    ai_thinking: "L’IA réfléchit",
    toggled_to: "Langue changée en",
    dataset_loaded: "Fichier chargé :",
    suggestions: "Suggestions",
    only_problem_cols: "Seules les colonnes en erreur sont listées.",
    apply_all_ok: "Corrections appliquées.",
    reset_ok: "Interface réinitialisée.",
    analyze_progress: "Analyse du fichier…",
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
    drop_sub: "CSV, Excel, JSON, TXT (≤ 50 MB). Your data stays in your browser.",
    size_ok: "Max size: 50 MB",
    free_limit: "Free analysis: 1k rows",
    privacy: "Local secure processing",
    reset: "Reset",
    score_title: "Global score",
    rows_analyzed: "Rows analyzed",
    cols_found: "Columns found",
    issues_found: "Issues detected",
    problems_cols: "Columns with issues",
    type: "type",
    quality: "Quality",
    dedupe: "Remove duplicates",
    impute: "Imputation",
    impute_none: "None",
    impute_mean: "Mean (num.)",
    impute_mode: "Mode (cat.)",
    standardize: "Standardize (format/text)",
    keep_as_is: "Keep as-is",
    apply_selected: "Apply selected",
    download_csv: "Download cleaned CSV",
    fixes_log: "Applied fixes",
    stats_title: "Descriptive Statistics",
    stats_missing_by_col: "Per-column summary",
    stats_synth: "Global synthesis",
    mean: "Mean",
    median: "Median",
    std: "Std. dev.",
    missing: "Missing",
    unique: "Unique",
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
    next_run: "Next run",
    last_dryrun: "Last dry-run",
    jobs_title: "Jobs history",
    status: "Status",
    running: "running",
    completed: "completed",
    failed: "failed",
    no_data_yet: "No data to show yet.",
    assistant: "AI Assistant",
    expert: "Data-cleaning expert",
    ask_placeholder: "Ask a question about your data…",
    send: "Send",
    ai_thinking: "AI is thinking",
    toggled_to: "Language switched to",
    dataset_loaded: "File loaded:",
    suggestions: "Suggestions",
    only_problem_cols: "Only columns with issues are listed.",
    apply_all_ok: "Fixes applied.",
    reset_ok: "Interface reset.",
    analyze_progress: "Analyzing file…",
  },
};

const useI18n = () => {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "fr");
  const t = useMemo(() => (k: string) => dict[lang][k] ?? k, [lang]);
  const toggle = () =>
    setLang((prev) => {
      const nxt = prev === "fr" ? "en" : "fr";
      localStorage.setItem("lang", nxt);
      document.documentElement.lang = nxt;
      return nxt;
    });
  return { lang, t, toggle };
};

/* -------------------------------------------------------
   🧰  Helpers
------------------------------------------------------- */
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
  missingPct: number; // 0..100
  duplicatesPct: number;
  invalidPct: number;
  quality: number; // 0..100
};

const darkSelectStyle: React.CSSProperties = {
  backgroundColor: "#202433",
  color: "#e5e7eb",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: 8,
  padding: "8px 10px",
  appearance: "none" as any,
};

const badge: React.CSSProperties = {
  padding: "4px 10px",
  background: "rgba(255,255,255,0.06)",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  fontSize: 12,
};

const isBlank = (v: any) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

const asNumber = (v: any) => {
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const median = (nums: number[]) => {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

const stddev = (nums: number[]) => {
  const a = nums.filter((n) => Number.isFinite(n));
  if (!a.length) return NaN;
  const mean = a.reduce((s, n) => s + n, 0) / a.length;
  const v = a.reduce((s, n) => s + (n - mean) ** 2, 0) / a.length;
  return Math.sqrt(v);
};

/* Regex validators (simples mais efficaces) */
const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const reURL =
  /^(https?:\/\/)?([a-z0-9\-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;
const rePhone = /^\+?[0-9 ()\-]{6,}$/;
const reIBAN = /^[A-Z]{2}[0-9A-Z]{13,30}$/;

const toISODate = (v: any) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const normalizeText = (s: any) =>
  typeof s === "string"
    ? s
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim()
    : s;

const standardizePhone = (s: any) => {
  if (typeof s !== "string") return s;
  let t = s.replace(/[^\d+]/g, "");
  if (t.startsWith("00")) t = "+" + t.slice(2);
  if (!t.startsWith("+")) t = "+".concat(t);
  return t;
};

const detectColType = (values: any[]): ColType => {
  const sample = values.filter((v) => !isBlank(v)).slice(0, 200);
  if (!sample.length) return "unknown";
  const scores: Record<ColType, number> = {
    number: 0,
    text: 0,
    date: 0,
    email: 0,
    phone: 0,
    url: 0,
    boolean: 0,
    iban: 0,
    unknown: 0,
  };
  for (const v of sample) {
    const s = String(v).trim();
    if (reEmail.test(s)) scores.email++;
    if (reURL.test(s)) scores.url++;
    if (rePhone.test(s)) scores.phone++;
    if (reIBAN.test(s)) scores.iban++;
    if (["true", "false", "0", "1", "yes", "no"].includes(s.toLowerCase()))
      scores.boolean++;
    if (!isNaN(asNumber(s))) scores.number++;
    if (!isNaN(new Date(s).getTime())) scores.date++;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] === 0) return "text";
  // Favoriser number > date > email > phone > url > boolean > iban > text
  const priority: ColType[] = [
    "number",
    "date",
    "email",
    "phone",
    "url",
    "boolean",
    "iban",
    "text",
  ];
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k as ColType);
  for (const p of priority) if (sorted.includes(p)) return p;
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

const computeMetrics = (rows: Row[], columns: string[]): ColMetrics[] => {
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
    const penalty = (missingPct + invalidPct + duplicatesPct / 2) / 2; // poids
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

/* CSV parser simple */
const parseCSV = async (file: File): Promise<Row[]> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const text = String(fr.result ?? "");
      const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
      if (!lines.length) return resolve([]);
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows: Row[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row: Row = {};
        // découpage naïf (OK pour MVP)
        const cells = [];
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
        headers.forEach((h, j) => (row[h] = (cells[j] ?? "").replace(/^"|"$/g, "")));
        rows.push(row);
      }
      resolve(rows);
    };
    fr.readAsText(file);
  });

/* Excel via CDN xlsx */
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
const parseExcel = async (file: File): Promise<Row[]> => {
  const XLSX = await loadXLSX();
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });
};

/* JSON */
const parseJSON = async (file: File): Promise<Row[]> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      try {
        const v = JSON.parse(String(fr.result ?? "[]"));
        if (Array.isArray(v)) resolve(v as Row[]);
        else resolve([v as Row]);
      } catch (e) {
        reject(e);
      }
    };
    fr.readAsText(file);
  });

/* -------------------------------------------------------
   🧠  Main Component
------------------------------------------------------- */
export default function App() {
  const { lang, t, toggle } = useI18n();

  // Tabs
  type Tab = "analyze" | "stats" | "schedule" | "jobs";
  const [tab, setTab] = useState<Tab>("analyze");

  // Data
  const [raw, setRaw] = useState<Row[]>([]);
  const [data, setData] = useState<Row[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<ColMetrics[]>([]);
  const [score, setScore] = useState<number>(0);

  // Actions
  type Action = {
    dedupe: boolean;
    impute: "none" | "mean" | "mode";
    standardize: boolean;
    keep: boolean;
  };
  const [actions, setActions] = useState<Record<string, Action>>({});
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Schedule / Jobs
  type Schedule = {
    id: string;
    name: string;
    freq: "daily" | "weekly" | "monthly";
    time: string;
    source: "current" | "demo";
    createdAt: number;
    lastDryRun?: number;
    nextRunISO?: string;
  };
  type Job = { id: string; name: string; status: "running" | "completed" | "failed"; at: number };
  const [schedules, setSchedules] = useState<Schedule[]>(() =>
    JSON.parse(localStorage.getItem("schedules") || "[]")
  );
  const [jobs, setJobs] = useState<Job[]>(() =>
    JSON.parse(localStorage.getItem("jobs") || "[]")
  );

  useEffect(() => {
    localStorage.setItem("schedules", JSON.stringify(schedules));
  }, [schedules]);
  useEffect(() => {
    localStorage.setItem("jobs", JSON.stringify(jobs));
  }, [jobs]);

  /* Upload handler */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    setBusy(t("analyze_progress"));
    try {
      let rows: Row[] = [];
      if (/\.(csv)$/i.test(f.name)) rows = await parseCSV(f);
      else if (/\.(xlsx|xls)$/i.test(f.name)) rows = await parseExcel(f);
      else if (/\.(json)$/i.test(f.name)) rows = await parseJSON(f);
      else if (/\.(txt)$/i.test(f.name)) rows = await parseCSV(f as any);
      else rows = await parseCSV(f as any);

      // Free tier: 1000 rows
      if (rows.length > 1000) rows = rows.slice(0, 1000);

      const headers = Object.keys(rows[0] || {});
      const m = computeMetrics(rows, headers);
      const avg = m.length ? m.reduce((s, c) => s + c.quality, 0) / m.length : 0;

      const defaultActions: Record<string, Action> = {};
      m.forEach((c) => {
        defaultActions[c.name] = {
          dedupe: c.duplicatesPct > 0,
          impute: c.missingPct > 0 ? (c.type === "number" ? "mean" : "mode") : "none",
          standardize: ["email", "phone", "date", "url", "text"].includes(c.type),
          keep: false,
        };
      });

      setRaw(rows);
      setData(rows);
      setCols(headers);
      setMetrics(m);
      setScore(Math.round(avg));
      setActions(defaultActions);
      setLog((l) => [`${t("dataset_loaded")} ${f.name}`, ...l]);
      setTab("analyze");
    } catch (e: any) {
      alert("Upload error: " + e?.message);
    } finally {
      setBusy(null);
    }
  };

  /* Apply fixes */
  const applyAll = () => {
    if (!data.length) return;
    let rows = [...data];
    const newLog: string[] = [];

    for (const c of cols) {
      const act = actions[c] || { dedupe: false, impute: "none", standardize: false, keep: false };
      if (act.keep) continue;

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
        if (unique.length !== rows.length) {
          newLog.push(`🧹 ${c}: ${lang === "fr" ? "doublons supprimés" : "duplicates removed"} (${rows.length - unique.length})`);
          rows = unique;
        }
      }

      // impute
      if (act.impute !== "none") {
        if (act.impute === "mean") {
          const nums = rows.map((r) => asNumber(r[c])).filter((n) => Number.isFinite(n));
          const m = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : NaN;
          if (Number.isFinite(m)) {
            rows = rows.map((r) => (isBlank(r[c]) ? { ...r, [c]: m } : r));
            newLog.push(`➕ ${c}: ${lang === "fr" ? "imputation moyenne" : "mean imputation"} (${m.toFixed(2)})`);
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
            newLog.push(`➕ ${c}: ${lang === "fr" ? "imputation mode" : "mode imputation"} (${best})`);
          }
        }
      }

      // standardize
      if (act.standardize) {
        const mt = metrics.find((m) => m.name === c)?.type ?? "text";
        rows = rows.map((r) => {
          const v = r[c];
          if (isBlank(v)) return r;
          let nv = v;
          switch (mt) {
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
        newLog.push(`✨ ${c}: ${lang === "fr" ? "standardisation" : "standardized"}`);
      }
    }

    // Recompute metrics/score
    const m = computeMetrics(rows, cols);
    const avg = m.length ? m.reduce((s, c) => s + c.quality, 0) / m.length : 0;
    setData(rows);
    setMetrics(m);
    setScore(Math.round(avg));
    setLog((l) => [...newLog, ...l]);
    alert(t("apply_all_ok"));
  };

  const resetAll = () => {
    setRaw([]);
    setData([]);
    setCols([]);
    setMetrics([]);
    setScore(0);
    setActions({});
    setLog([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    alert(t("reset_ok"));
  };

  /* Stats summaries (text instead of charts) */
  const numericCols = useMemo(
    () =>
      metrics
        .filter((m) => m.type === "number")
        .map((m) => m.name),
    [metrics]
  );
  const statsText = useMemo(() => {
    if (!data.length) return [];
    const S: { name: string; mean: number; median: number; std: number; missingPct: number }[] =
      [];
    for (const c of numericCols) {
      const arr = data.map((r) => asNumber(r[c]));
      const m = arr.filter((n) => Number.isFinite(n));
      const missPct = (1 - m.length / arr.length) * 100;
      S.push({
        name: c,
        mean: m.length ? m.reduce((s, n) => s + n, 0) / m.length : NaN,
        median: median(m),
        std: stddev(m),
        missingPct: missPct,
      });
    }
    return S.slice(0, 6);
  }, [data, numericCols]);

  const interpretations = useMemo(() => {
    if (!metrics.length) return [];
    const outs: string[] = [];
    for (const m of metrics) {
      if (m.missingPct > 20)
        outs.push(
          `⚠️ ${m.name}: ${Math.round(m.missingPct)}% ${lang === "fr" ? "manquants" : "missing"} – ${lang === "fr" ? "imputation recommandée" : "imputation recommended"}`
        );
      if (m.invalidPct > 5)
        outs.push(
          `🚫 ${m.name}: ${Math.round(m.invalidPct)}% ${lang === "fr" ? "invalides" : "invalid"} – ${lang === "fr" ? "standardiser/valider" : "standardize/validate"}`
        );
      if (m.duplicatesPct > 0)
        outs.push(
          `🔁 ${m.name}: ${Math.round(m.duplicatesPct)}% ${lang === "fr" ? "doublons" : "duplicates"} – ${lang === "fr" ? "dédoublonnage conseillé" : "dedupe advised"}`
        );
    }
    if (!outs.length) outs.push(lang === "fr" ? "👌 Données propres." : "👌 Data looks clean.");
    return outs.slice(0, 6);
  }, [metrics, lang]);

  /* Schedule */
  const [newJob, setNewJob] = useState<Schedule>({
    id: crypto.randomUUID(),
    name: "",
    freq: "daily",
    time: "09:00",
    source: "current",
    createdAt: Date.now(),
  });

  const addSchedule = () => {
    if (!newJob.name.trim()) return alert("Missing job name");
    const j = { ...newJob, id: crypto.randomUUID(), createdAt: Date.now() };
    setSchedules((s) => [j, ...s]);
    setNewJob({
      id: crypto.randomUUID(),
      name: "",
      freq: "daily",
      time: "09:00",
      source: "current",
      createdAt: Date.now(),
    });
  };

  const dryRun = (id: string) => {
    const sc = schedules.find((s) => s.id === id);
    if (!sc) return;
    // simulate a small job
    const j: Job = {
      id: crypto.randomUUID(),
      name: sc.name,
      status: "completed",
      at: Date.now(),
    };
    setJobs((js) => [j, ...js]);
    setSchedules((ss) =>
      ss.map((s) => (s.id === id ? { ...s, lastDryRun: Date.now(), nextRunISO: new Date(Date.now() + 24 * 3600 * 1000).toISOString() } : s))
    );
  };

  /* Download CSV */
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

  /* UI bits */
  const problemCols = metrics.filter(
    (m) => m.missingPct > 0 || m.invalidPct > 0 || m.duplicatesPct > 0
  );

  const setAction = (col: string, patch: Partial<Action>) =>
    setActions((a) => ({ ...a, [col]: { ...(a[col] || { dedupe: false, impute: "none", standardize: false, keep: false }), ...patch } }));

  const chip = (text: string) => (
    <span style={badge}>{text}</span>
  );

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
                setLog((l) => [`🌐 ${t("toggled_to")} ${lang === "fr" ? "EN" : "FR"}`, ...l]);
              }}
              style={{
                ...badge,
                padding: "6px 10px",
                cursor: "pointer",
                background: "rgba(255,255,255,0.08)",
              }}
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
              { id: "jobs", label: t("nav_jobs") },
            ].map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id as Tab)}
                style={{
                  padding: "14px 18px",
                  background: tab === n.id ? "rgba(74,144,226,0.07)" : "transparent",
                  color: tab === n.id ? "#4a90e2" : "rgba(255,255,255,0.8)",
                  border: "none",
                  borderBottom: `3px solid ${tab === n.id ? "#4a90e2" : "transparent"}`,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24, display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        {/* Main */}
        <main style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20, minHeight: 560 }}>
          {/* Analyze */}
          {tab === "analyze" && (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed rgba(255,255,255,0.35)",
                  borderRadius: 12,
                  padding: "44px 24px",
                  textAlign: "center",
                  background: "rgba(255,255,255,0.02)",
                  cursor: "pointer",
                }}
              >
                <div style={{ width: 64, height: 64, borderRadius: 12, background: "#4a90e2", display: "grid", placeItems: "center", margin: "0 auto 16px", fontSize: 24 }}>📤</div>
                <h2 style={{ fontSize: 20, marginBottom: 6 }}>{t("drop_title")}</h2>
                <p style={{ opacity: 0.8, marginBottom: 14 }}>{t("drop_sub")}</p>
                <div style={{ display: "flex", gap: 18, justifyContent: "center", opacity: 0.85, fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#4ade80" }}></span>{t("size_ok")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#4a90e2" }}></span>{t("free_limit")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#a855f7" }}></span>{t("privacy")}</div>
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.json,.txt" multiple style={{ display: "none" }} onChange={(e) => onFiles(e.target.files)} />
              </div>

              {busy && <div style={{ marginTop: 12, opacity: 0.9 }}>{busy}</div>}

              {/* KPI cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginTop: 18 }}>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: score >= 80 ? "#4ade80" : score >= 60 ? "#eab308" : "#f97316" }}>{Math.round(score)}%</div>
                  <div style={{ opacity: 0.8 }}>{t("score_title")}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{data.length}</div>
                  <div style={{ opacity: 0.8 }}>{t("rows_analyzed")}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{cols.length}</div>
                  <div style={{ opacity: 0.8 }}>{t("cols_found")}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{problemCols.length}</div>
                  <div style={{ opacity: 0.8 }}>{t("issues_found")}</div>
                </div>
              </div>

              {/* Columns with issues */}
              <div style={{ marginTop: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 20 }}>{t("problems_cols")}</h3>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={applyAll} disabled={!data.length} style={{ ...badge, padding: "8px 12px", cursor: "pointer", background: "#2563eb" }}>
                      ✅ {t("apply_selected")}
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
                      const a = actions[c.name] || { dedupe: false, impute: "none", standardize: false, keep: false };
                      return (
                        <div key={c.name} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 17 }}>{c.name}</strong>
                              {chip(`${t("type")}: ${c.type}`)}
                              {chip(`${t("quality")}: ${Math.round(c.quality)}%`)}
                              {chip(`${t("missing")}: ${Math.round(c.missingPct)}%`)}
                              {chip(`dup: ${Math.round(c.duplicatesPct)}%`)}
                              {chip(`inv: ${Math.round(c.invalidPct)}%`)}
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
                            {/* dedupe */}
                            <label style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                              <input type="checkbox" checked={a.dedupe} onChange={(e) => setAction(c.name, { dedupe: e.target.checked })} />
                              {t("dedupe")}
                            </label>

                            {/* imputation */}
                            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                              <span>{t("impute")}:</span>
                              <select
                                value={a.impute}
                                onChange={(e) => setAction(c.name, { impute: e.target.value as any })}
                                style={{ ...darkSelectStyle, width: "100%" }}
                              >
                                <option value="none" style={{ background: "#202433" }}>{t("impute_none")}</option>
                                <option value="mean" style={{ background: "#202433" }}>{t("impute_mean")}</option>
                                <option value="mode" style={{ background: "#202433" }}>{t("impute_mode")}</option>
                              </select>
                            </div>

                            {/* standardize */}
                            <label style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                              <input type="checkbox" checked={a.standardize} onChange={(e) => setAction(c.name, { standardize: e.target.checked })} />
                              {t("standardize")}
                            </label>

                            {/* keep */}
                            <label style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                              <input type="checkbox" checked={a.keep} onChange={(e) => setAction(c.name, { keep: e.target.checked })} />
                              {t("keep_as_is")}
                            </label>
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
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 }}>
                  <strong>{t("stats_missing_by_col")}</strong>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {metrics.slice(0, 8).map((m) => (
                      <div key={m.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: 8 }}>
                        <span>{m.name}</span>
                        <span>{Math.round(m.missingPct)}% {t("missing")}</span>
                      </div>
                    ))}
                    {!metrics.length && <div style={{ opacity: 0.7 }}>{t("no_data_yet")}</div>}
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 }}>
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
                      {interpretations.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
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
                <input
                  placeholder={t("job_name")}
                  value={newJob.name}
                  onChange={(e) => setNewJob((j) => ({ ...j, name: e.target.value }))}
                  style={{ ...darkSelectStyle, padding: "10px 12px" }}
                />
                <select
                  value={newJob.freq}
                  onChange={(e) => setNewJob((j) => ({ ...j, freq: e.target.value as any }))}
                  style={darkSelectStyle}
                >
                  <option value="daily" style={{ background: "#202433" }}>{t("freq_daily")}</option>
                  <option value="weekly" style={{ background: "#202433" }}>{t("freq_weekly")}</option>
                  <option value="monthly" style={{ background: "#202433" }}>{t("freq_monthly")}</option>
                </select>
                <input
                  type="time"
                  value={newJob.time}
                  onChange={(e) => setNewJob((j) => ({ ...j, time: e.target.value }))}
                  style={{ ...darkSelectStyle, padding: "10px 12px" }}
                />
                <select
                  value={newJob.source}
                  onChange={(e) => setNewJob((j) => ({ ...j, source: e.target.value as any }))}
                  style={darkSelectStyle}
                >
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
                  <div key={s.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10 }}>
                    <div><b>{s.name}</b></div>
                    <div>{t("frequency")}: {s.freq}</div>
                    <div>{t("run_time")}: {s.time}</div>
                    <div>{t("next_run")}: {s.nextRunISO ? new Date(s.nextRunISO).toLocaleString() : "-"}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => dryRun(s.id)} style={{ ...badge, padding: "8px 10px", cursor: "pointer", background: "rgba(255,255,255,0.08)" }}>
                        ▶ {t("dry_run")}
                      </button>
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
                  <div key={j.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div><b>{j.name}</b></div>
                    <div>{t("status")}: {t(j.status)}</div>
                    <div>{new Date(j.at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar – Assistant + Log */}
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
                  {lang === "fr"
                    ? "Salut ! Je suis votre assistant IA. Uploadez un fichier et je vous aiderai."
                    : "Hi! I’m your AI assistant. Upload a file and I’ll help you."}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {["Quels sont les doublons détectés ?", "Recommande-moi des règles de validation", "Explique-moi ces anomalies"].map((q) => (
                  <button key={q} onClick={() => ask(q)} style={{ textAlign: "left", background: "rgba(74,144,226,0.12)", border: "1px solid rgba(74,144,226,0.35)", color: "#4a90e2", padding: "6px 8px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
                    {lang === "fr" ? q : translatePreset(q)}
                  </button>
                ))}
              </div>
            </div>
            <ChatInput onSend={(m) => ask(m)} placeholder={t("ask_placeholder")} />
          </div>

          {/* Log */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 12, minHeight: 140 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>🗒 {t("fixes_log")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, maxHeight: 180, overflowY: "auto" }}>
              {!log.length && <div style={{ opacity: 0.7 }}>{t("no_data_yet")}</div>}
              {log.map((l, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: "6px 8px", borderRadius: 8 }}>
                  {l}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );

  // --- mini chat wired to your /api/openai route (fallback local answers)
  async function ask(message: string) {
    if (!message.trim()) return;
    addUser(message);
    addTyping(true);
    try {
      const res = await fetch("/api/openai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: message,
          context: {
            score,
            problems: problemCols.slice(0, 5),
            columns: cols,
          },
        }),
      }).catch(() => null);

      let txt = "";
      if (res && res.ok) {
        const j = await res.json();
        txt = j?.reply || "";
      }
      if (!txt) {
        // fallback local rules
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

  function addUser(text: string) {
    const wrap = document.getElementById("chat");
    if (!wrap) return;
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.flexDirection = "row-reverse";
    const avatar = document.createElement("div");
    avatar.style.width = "28px";
    avatar.style.height = "28px";
    avatar.style.borderRadius = "999px";
    avatar.style.background = "#4a90e2";
    avatar.style.display = "grid";
    avatar.style.placeItems = "center";
    avatar.textContent = "👤";
    const bubble = document.createElement("div");
    bubble.style.background = "#4a90e2";
    bubble.style.padding = "8px 10px";
    bubble.style.borderRadius = "10px";
    bubble.style.maxWidth = "240px";
    bubble.style.fontSize = "13px";
    bubble.textContent = text;
    row.appendChild(avatar);
    row.appendChild(bubble);
    wrap.appendChild(row);
    wrap.scrollTop = wrap.scrollHeight;
  }
  function addAI(text: string) {
    const wrap = document.getElementById("chat");
    if (!wrap) return;
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    const avatar = document.createElement("div");
    avatar.style.width = "28px";
    avatar.style.height = "28px";
    avatar.style.borderRadius = "999px";
    avatar.style.background = "linear-gradient(135deg,#8b5cf6,#a855f7)";
    avatar.style.display = "grid";
    avatar.style.placeItems = "center";
    avatar.textContent = "🤖";
    const bubble = document.createElement("div");
    bubble.style.background = "rgba(255,255,255,0.08)";
    bubble.style.padding = "8px 10px";
    bubble.style.borderRadius = "10px";
    bubble.style.maxWidth = "240px";
    bubble.style.fontSize = "13px";
    bubble.textContent = text;
    row.appendChild(avatar);
    row.appendChild(bubble);
    wrap.appendChild(row);
    wrap.scrollTop = wrap.scrollHeight;
  }
  function addTyping(on: boolean) {
    const wrap = document.getElementById("chat");
    if (!wrap) return;
    const id = "typing";
    const ex = document.getElementById(id);
    if (ex) ex.remove();
    if (!on) return;
    const row = document.createElement("div");
    row.id = id;
    row.style.opacity = "0.75";
    row.style.fontSize = "12px";
    row.textContent = `⋯ ${t("ai_thinking")} ⋯`;
    wrap.appendChild(row);
    wrap.scrollTop = wrap.scrollHeight;
  }
}

/* -------------------------------------------------------
   ✉️ Chat input component
------------------------------------------------------- */
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
              if (v.trim()) {
                onSend(v.trim());
                setV("");
              }
            }
          }}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 12px",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => {
            if (v.trim()) {
              onSend(v.trim());
              setV("");
            }
          }}
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            background: "#4a90e2",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
