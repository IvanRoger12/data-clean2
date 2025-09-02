import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

// ---- Chart.js setup -----------------------------------------
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

// ---- Types ---------------------------------------------------
type Row = Record<string, any>;
type Table = { rows: Row[]; columns: string[] };
type ColMetrics = {
  name: string;
  type: DetectedType;
  missingPct: number;
  duplicatePct: number;
  invalidPct: number;
  outlierPct: number;
  quality: number; // 0..100
};
type DetectedType =
  | "number"
  | "date"
  | "email"
  | "phone"
  | "url"
  | "iban"
  | "boolean"
  | "text"
  | "unknown";

type FixOptions = {
  removeDuplicates?: boolean;
  impute?: "mean" | "mode" | "none";
  standardize?: boolean; // email lower/trim, date ISO, phone E.164-ish, text trim/no accents
  keep?: boolean;
};

type FixPlan = Record<string, FixOptions>;

type Job = {
  id: string;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  time: string; // HH:mm
  source: "current" | "demo" | "url";
  url?: string;
  status: "pending" | "running" | "completed" | "failed";
  lastRun?: string;
  nextRun?: string;
  progress?: number;
  resultCsvHref?: string;
};

// ---- Globals for CDN libs ------------------------------------
declare global {
  interface Window {
    Papa?: any;
    XLSX?: any;
  }
}

// ---- Small helpers -------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const formatter = new Intl.NumberFormat("fr-FR");

const emailRegex =
  // RFC 5322-ish (simple)
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const phoneDigits = (s: string) => (s || "").replace(/\D+/g, "");
const urlIsValid = (v: string) => {
  try {
    // allow missing protocol by prefixing
    const u = v.match(/^https?:\/\//i) ? v : `https://${v}`;
    new URL(u);
    return true;
  } catch {
    return false;
  }
};
const isIBAN = (str: string) => /^[A-Z]{2}[0-9A-Z]{13,34}$/i.test(str || "");

// Accent remover
const stripAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss");

// Quality score
const qualityScore = (m: {
  missingPct: number;
  duplicatePct: number;
  invalidPct: number;
  outlierPct: number;
}) => {
  const penalty =
    m.missingPct * 0.4 +
    m.duplicatePct * 0.25 +
    m.invalidPct * 0.25 +
    m.outlierPct * 0.1;
  return Math.max(0, Math.min(100, 100 - penalty));
};

// Guess column type
function detectType(values: any[]): DetectedType {
  const samples = values.slice(0, 200).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (samples.length === 0) return "unknown";

  const checks = {
    number: 0,
    date: 0,
    email: 0,
    phone: 0,
    url: 0,
    iban: 0,
    boolean: 0,
  };

  for (const v of samples) {
    const s = String(v).trim();
    if (!Number.isNaN(Number(String(v).replace(",", ".")))) checks.number++;
    if (!Number.isNaN(Date.parse(s))) checks.date++;
    if (emailRegex.test(s)) checks.email++;
    const pd = phoneDigits(s);
    if (pd.length >= 8 && pd.length <= 15) checks.phone++;
    if (urlIsValid(s)) checks.url++;
    if (isIBAN(s)) checks.iban++;
    if (["true", "false", "0", "1", "oui", "non"].includes(s.toLowerCase())) checks.boolean++;
  }

  const best = Object.entries(checks).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] === 0) return "text";

  return best[0] as DetectedType;
}

// Compute metrics per column
function computeColMetrics(table: Table): ColMetrics[] {
  const rows = table.rows;
  const cols = table.columns;
  const metrics: ColMetrics[] = [];

  for (const c of cols) {
    const vals = rows.map((r) => r[c]);
    const missing = vals.filter((v) => v === null || v === undefined || String(v).trim() === "").length;
    const missingPct = (missing / Math.max(1, rows.length)) * 100;

    // duplicates (non-null)
    const nonNull = vals
      .filter((v) => !(v === null || v === undefined || String(v).trim() === ""))
      .map((v) => String(v).trim());
    const set = new Set<string>();
    let dup = 0;
    for (const v of nonNull) {
      if (set.has(v)) dup++;
      else set.add(v);
    }
    const duplicatePct = (dup / Math.max(1, nonNull.length)) * 100;

    // detect type + invalids
    const type = detectType(vals);
    let invalid = 0;
    let outliersPct = 0;

    if (type === "number") {
      const nums = vals
        .map((v) => (v === null || v === undefined || String(v).trim() === "" ? null : Number(String(v).replace(",", "."))))
        .filter((v) => v !== null) as number[];
      const invalids = vals.filter(
        (v) =>
          !(v === null || v === undefined || String(v).trim() === "") &&
          Number.isNaN(Number(String(v).replace(",", ".")))
      ).length;
      invalid = invalids;

      // outliers via z-score > 3
      const mean = nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length);
      const std = Math.sqrt(
        nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / Math.max(1, nums.length)
      );
      const outliers = nums.filter((v) => std > 0 && Math.abs((v - mean) / std) > 3).length;
      outliersPct = (outliers / Math.max(1, nums.length)) * 100;
    } else if (type === "date") {
      invalid = vals.filter(
        (v) => !(v === null || v === undefined || String(v).trim() === "") && Number.isNaN(Date.parse(String(v)))
      ).length;
    } else if (type === "email") {
      invalid = vals.filter(
        (v) => !(v === null || v === undefined || String(v).trim() === "") && !emailRegex.test(String(v))
      ).length;
    } else if (type === "phone") {
      invalid = vals.filter((v) => {
        if (v === null || v === undefined || String(v).trim() === "") return false;
        const pd = phoneDigits(String(v));
        return pd.length < 8 || pd.length > 15;
      }).length;
    } else if (type === "url") {
      invalid = vals.filter((v) => !(v === null || v === undefined || String(v).trim() === "") && !urlIsValid(String(v)))
        .length;
    } else if (type === "iban") {
      invalid = vals.filter((v) => !(v === null || v === undefined || String(v).trim() === "") && !isIBAN(String(v)))
        .length;
    } else if (type === "boolean") {
      invalid = vals.filter((v) => {
        if (v === null || v === undefined || String(v).trim() === "") return false;
        const s = String(v).toLowerCase().trim();
        return !["true", "false", "0", "1", "oui", "non"].includes(s);
      }).length;
    } else {
      invalid = 0;
    }

    const invalidPct = (invalid / Math.max(1, rows.length)) * 100;
    const quality = qualityScore({
      missingPct,
      duplicatePct,
      invalidPct,
      outlierPct: outliersPct,
    });

    metrics.push({
      name: c,
      type,
      missingPct,
      duplicatePct,
      invalidPct,
      outlierPct: outliersPct,
      quality,
    });
  }
  return metrics.sort((a, b) => a.quality - b.quality);
}

// Apply fixes
function applyFixes(table: Table, plan: FixPlan): { table: Table; log: string[] } {
  let rows = [...table.rows];
  const columns = table.columns;
  const log: string[] = [];

  // Remove duplicates per-column implies dedupe on that column (composite simple: all selected)
  const dedupeCols = Object.entries(plan)
    .filter(([, v]) => v.removeDuplicates)
    .map(([k]) => k);

  if (dedupeCols.length > 0) {
    const keySet = new Set<string>();
    const newRows: Row[] = [];
    for (const r of rows) {
      const key = dedupeCols.map((c) => (r[c] ?? "")).join("||");
      if (!keySet.has(key)) {
        keySet.add(key);
        newRows.push({ ...r });
      }
    }
    log.push(`🧹 Doublons supprimés selon: ${dedupeCols.join(", ")} (${rows.length - newRows.length} lignes retirées)`);
    rows = newRows;
  }

  // Impute + standardize
  for (const col of columns) {
    const opt = plan[col];
    if (!opt) continue;

    // Standardize
    if (opt.standardize) {
      // Detect type from current column values
      const values = rows.map((r) => r[col]);
      const t = detectType(values);

      if (t === "email") {
        for (const r of rows) {
          if (r[col] !== null && r[col] !== undefined && String(r[col]).trim() !== "") {
            r[col] = String(r[col]).trim().toLowerCase();
          }
        }
        log.push(`📧 Emails standardisés (lowercase, trim) sur "${col}"`);
      } else if (t === "date") {
        for (const r of rows) {
          const v = r[col];
          if (v !== null && v !== undefined && String(v).trim() !== "") {
            const d = new Date(String(v));
            if (!isNaN(d.getTime())) {
              r[col] = d.toISOString().slice(0, 10); // YYYY-MM-DD
            }
          }
        }
        log.push(`📅 Dates converties en ISO (YYYY-MM-DD) sur "${col}"`);
      } else if (t === "phone") {
        for (const r of rows) {
          const v = String(r[col] ?? "");
          if (v.trim() !== "") {
            const pd = phoneDigits(v);
            r[col] = pd ? `+${pd}` : v;
          }
        }
        log.push(`📞 Téléphones normalisés (E.164 simplifié) sur "${col}"`);
      } else if (t === "text" || t === "unknown" || t === "url" || t === "iban") {
        for (const r of rows) {
          const v = r[col];
          if (v !== null && v !== undefined && String(v).trim() !== "") {
            r[col] = stripAccents(String(v).trim());
          }
        }
        log.push(`📝 Texte normalisé (trim + accents) sur "${col}"`);
      }
    }

    // Impute
    if (opt.impute && opt.impute !== "none") {
      const values = rows.map((r) => r[col]);
      const t = detectType(values);
      if (opt.impute === "mean" && t === "number") {
        const nums = values
          .map((v) => (v === null || v === undefined || String(v).trim() === "" ? null : Number(String(v).replace(",", "."))))
          .filter((v) => v !== null) as number[];
        const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        for (const r of rows) {
          const v = r[col];
          if (v === null || v === undefined || String(v).trim() === "") {
            r[col] = Number.isFinite(mean) ? Number(mean.toFixed(2)) : 0;
          }
        }
        log.push(`➕ Valeurs manquantes imputées (moyenne) sur "${col}"`);
      } else {
        // mode (works for any type)
        const counts = new Map<string, number>();
        for (const v of values) {
          const s = String(v ?? "").trim();
          if (s === "") continue;
          counts.set(s, (counts.get(s) ?? 0) + 1);
        }
        let mode = "";
        let best = -1;
        for (const [k, n] of counts) {
          if (n > best) {
            best = n;
            mode = k;
          }
        }
        for (const r of rows) {
          const v = r[col];
          if (v === null || v === undefined || String(v).trim() === "") {
            r[col] = mode;
          }
        }
        log.push(`➕ Valeurs manquantes imputées (mode "${mode || "∅"}") sur "${col}"`);
      }
    }
  }

  return { table: { rows, columns: table.columns }, log };
}

// CSV export
function toCsv(table: Table): string {
  const { columns, rows } = table;
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n");
}

// ---- CDN loaders (no extra deps in package.json) -------------
function loadScriptOnce(src: string, globalKey: "Papa" | "XLSX"): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any)[globalKey]) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error(`Impossible de charger ${src}. Vérifiez votre connexion internet.`));
    document.head.appendChild(s);
  });
}

async function parseCSVFile(file: File): Promise<Table> {
  await loadScriptOnce("https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js", "Papa");
  const text = await file.text();
  const parsed = window.Papa.parse(text, { header: true, skipEmptyLines: true });
  const rows: Row[] = parsed.data as Row[];
  const columns = parsed.meta.fields ?? Object.keys(rows[0] ?? {});
  return { rows, columns };
}

async function parseExcelFile(file: File): Promise<Table> {
  await loadScriptOnce(
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    "XLSX"
  );
  const array = await file.arrayBuffer();
  const wb = window.XLSX.read(array, { type: "array" });
  const first = wb.SheetNames[0];
  const ws = wb.Sheets[first];
  const json = window.XLSX.utils.sheet_to_json(ws, { defval: null }) as Row[];
  const columns = Object.keys(json[0] ?? {});
  return { rows: json, columns };
}

async function parseJSONFile(file: File): Promise<Table> {
  const text = await file.text();
  const data = JSON.parse(text);
  const rows: Row[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [data];
  const columns = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r || {}).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  return { rows, columns };
}

async function parseTXTFile(file: File): Promise<Table> {
  // Try CSV-like
  const csv: File = new File([await file.text()], file.name.replace(/\.txt$/i, ".csv"), {
    type: "text/csv",
  });
  return parseCSVFile(csv);
}

// ---- Charts component hooks ---------------------------------
function useBarChart(canvasRef: React.RefObject<HTMLCanvasElement>, labels: string[], values: number[], title: string) {
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const inst = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: title,
            data: values,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => `${v}%` } },
        },
      },
    });
    return () => inst.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(values), title]);
}

function usePieChart(canvasRef: React.RefObject<HTMLCanvasElement>, labels: string[], values: number[], title: string) {
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const inst = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            label: title,
            data: values,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" as const } },
      },
    });
    return () => inst.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(values), title]);
}

// ---- Main App -----------------------------------------------
export default function App() {
  const [tab, setTab] = useState<"analyze" | "stats" | "schedule" | "jobs">("analyze");
  const [table, setTable] = useState<Table | null>(null);
  const [originalTable, setOriginalTable] = useState<Table | null>(null);
  const [colMetrics, setColMetrics] = useState<ColMetrics[]>([]);
  const [fixPlan, setFixPlan] = useState<FixPlan>({});
  const [onlyErrors, setOnlyErrors] = useState(true);
  const [analysisLog, setAnalysisLog] = useState<string[]>([]);
  const [globalScore, setGlobalScore] = useState(0);
  const [kpi, setKpi] = useState({ dupRemoved: 0, missingImputed: 0, anomalies: 0 });

  // Preview pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = useMemo(
    () => (table ? Math.max(1, Math.ceil(Math.min(1000, table.rows.length) / pageSize)) : 1),
    [table]
  );

  // Assistant chat
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text:
        "Salut ! Je suis votre assistant IA spécialisé en nettoyage de données. Uploadez un fichier et je vous aiderai à l'analyser !",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);

  // Jobs
  const [jobs, setJobs] = useState<Job[]>(() => {
    try {
      const raw = localStorage.getItem("dc_jobs");
      return raw ? (JSON.parse(raw) as Job[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("dc_jobs", JSON.stringify(jobs));
  }, [jobs]);

  // ---- Styles (kept here for single-file drop-in) ----------
  useEffect(() => {
    const css = `
    :root{--bg:#1a1a2e;--panel:#111827;--panel2:#0f172a;--border:rgba(255,255,255,.08);--muted:rgba(255,255,255,.7);--text:#fff;--primary:#4a90e2;--purple:#8b5cf6;}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,system-ui,sans-serif}
    .header{background:var(--bg);border-bottom:1px solid var(--border);padding:16px 24px}
    .h-wrap{max-width:1400px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
    .logo{display:flex;gap:12px;align-items:center}
    .logo .icon{width:36px;height:36px;border-radius:8px;background:var(--primary);display:flex;align-items:center;justify-content:center}
    .logo small{display:block;color:var(--muted)}
    .actions{display:flex;gap:8px}
    .btn{background:rgba(255,255,255,.08);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:8px;cursor:pointer}
    .btn.primary{background:linear-gradient(135deg,#f59e0b,#f97316);border:none;font-weight:600}
    .nav{background:var(--bg);border-bottom:1px solid var(--border);padding:0 24px}
    .tabs{max-width:1400px;margin:0 auto;display:flex}
    .tab{padding:14px 18px;background:transparent;border:none;color:var(--muted);cursor:pointer;border-bottom:3px solid transparent}
    .tab.active{color:var(--primary);border-bottom-color:var(--primary);background:rgba(74,144,226,.06)}
    .main{max-width:1400px;margin:0 auto;padding:24px;display:flex;gap:24px}
    .panel{flex:1;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:16px;padding:20px;min-height:560px}
    .sidebar{width:340px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:16px;display:flex;flex-direction:column;height:560px;overflow:hidden}
    .chat-h{display:flex;gap:10px;align-items:center;padding:16px;border-bottom:1px solid var(--border)}
    .chip{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#8b5cf6,#a855f7);display:flex;align-items:center;justify-content:center}
    .cm{flex:1;padding:12px;display:flex;flex-direction:column;gap:10px;overflow:auto}
    .msg{display:flex;gap:10px;animation:msg .2s ease-out}
    .msg.user{flex-direction:row-reverse}
    .avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--primary)}
    .avatar.ai{background:linear-gradient(135deg,#8b5cf6,#a855f7)}
    .bubble{max-width:65%;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.06);font-size:14px;line-height:1.4}
    .msg.user .bubble{background:var(--primary)}
    .ci{padding:12px;border-top:1px solid var(--border);display:flex;gap:8px}
    .input{flex:1;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:12px;padding:8px 12px;color:var(--text)}
    .send{width:40px;height:40px;border-radius:50%;border:none;background:var(--primary);color:#fff;cursor:pointer}
    .upload{border:2px dashed rgba(255,255,255,.25);border-radius:12px;padding:48px;text-align:center;background:rgba(255,255,255,.02);cursor:pointer}
    .upload:hover{border-color:var(--primary);background:rgba(74,144,226,.06)}
    .muted{color:var(--muted)}
    .grid{display:grid;gap:12px}
    .cols-2{grid-template-columns:1fr 1fr}
    .cols-3{grid-template-columns:1fr 1fr 1fr}
    .table{width:100%;border-collapse:collapse}
    .table th,.table td{border-bottom:1px solid var(--border);padding:8px 10px;text-align:left;font-size:14px}
    .tag{display:inline-flex;gap:6px;align-items:center;padding:4px 8px;border-radius:999px;border:1px solid var(--border);font-size:12px}
    .danger{color:#f87171}
    .ok{color:#34d399}
    .warn{color:#fbbf24}
    .row{display:flex;gap:12px;align-items:center}
    .btn.solid{background:var(--primary);border:none}
    .kpis{display:grid;gap:12px;grid-template-columns:repeat(4,1fr)}
    .k{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:12px;padding:12px}
    .k .v{font-size:22px;font-weight:700}
    .list{display:flex;flex-direction:column;gap:10px}
    .fix{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;padding:10px}
    .log{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;padding:10px;max-height:140px;overflow:auto}
    .pagination{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:8px}
    @keyframes msg{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:1024px){.main{flex-direction:column}.sidebar{width:100%}}
    `;
    const el = document.createElement("style");
    el.innerHTML = css;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  // ---- File handling ----------------------------------------
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>("");

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    setFileName(f.name);
    setAnalysisLog([]);
    setPage(1);

    addAssistant(`📁 Fichier détecté "${f.name}". Lecture & pré-analyse en cours...`);

    let parsed: Table | null = null;

    try {
      if (/\.csv$/i.test(f.name)) parsed = await parseCSVFile(f);
      else if (/\.xlsx?$/i.test(f.name)) parsed = await parseExcelFile(f);
      else if (/\.json$/i.test(f.name)) parsed = await parseJSONFile(f);
      else if (/\.txt$/i.test(f.name)) parsed = await parseTXTFile(f);
      else throw new Error("Format non supporté. Utilisez CSV, Excel, JSON ou TXT.");

      // Limit to 50MB check
      if (f.size > 50 * 1024 * 1024) throw new Error("Fichier trop volumineux (>50 Mo)");

      // Free plan: 1k rows preview
      if (parsed.rows.length > 1000) {
        setAnalysisLog((l) => [...l, `ℹ️ Mode gratuit: analyse affichée sur 1 000 lignes / ${formatter.format(parsed!.rows.length)}.`]);
      }

      setOriginalTable(parsed);
      setTable(parsed);
      analyze(parsed);
      addAssistant("✅ Lecture terminée. Je vous propose des corrections ciblées colonne par colonne.");

      // switch to analyze tab
      setTab("analyze");
    } catch (e: any) {
      addAssistant(`❌ Erreur de lecture: ${e.message || e}`);
    }
  }

  function analyze(t: Table) {
    const m = computeColMetrics(t);
    setColMetrics(m);
    const avg = Math.round(
      m.reduce((a, b) => a + b.quality, 0) / Math.max(1, m.length)
    );
    setGlobalScore(avg);
    setFixPlan({});
    setAnalysisLog((l) => [
      ...l,
      `🔎 Colonnes: ${t.columns.length} • Lignes: ${formatter.format(t.rows.length)}`,
      `📊 Score qualité global estimé: ${avg}%`,
      `🔒 Vos données restent dans votre navigateur.`,
    ]);
  }

  // ---- Fix plan UI ------------------------------------------
  function updateFix(col: string, partial: Partial<FixOptions>) {
    setFixPlan((fp) => ({ ...fp, [col]: { ...fp[col], ...partial } }));
  }

  async function applyAllFixes() {
    if (!table) return;
    let beforeRows = table.rows.length;

    const { table: t2, log } = applyFixes(table, fixPlan);

    // KPIs
    const dupRemoved =
      beforeRows - t2.rows.length > 0 ? beforeRows - t2.rows.length : 0;

    // count imputations
    let missingImputed = 0;
    for (const col of table.columns) {
      if (fixPlan[col]?.impute && fixPlan[col]?.impute !== "none") {
        const beforeMissing = table.rows.filter(
          (r) => r[col] === null || r[col] === undefined || String(r[col]).trim() === ""
        ).length;
        const afterMissing = t2.rows.filter(
          (r) => r[col] === null || r[col] === undefined || String(r[col]).trim() === ""
        ).length;
        missingImputed += Math.max(0, beforeMissing - afterMissing);
      }
    }

    setTable(t2);
    analyze(t2);
    setKpi({ dupRemoved, missingImputed, anomalies: 0 });
    setAnalysisLog((l) => [...log, ...l]);
    addAssistant("✨ Corrections appliquées. Vous pouvez maintenant télécharger le fichier propre ou afficher les statistiques.");
  }

  // ---- Chat -------------------------------------------------
  function addAssistant(text: string) {
    setMessages((m) => [...m, { role: "assistant", text }]);
  }
  function addUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
  }
  async function sendChat() {
    const q = chatInput.trim();
    if (!q) return;
    addUser(q);
    setChatInput("");
    setThinking(true);
    try {
      const res = await fetch("/api/openai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Tu es un assistant expert en qualité de données. Réponds en français." },
            ...messages.map((m) => ({ role: m.role, content: m.text })),
            { role: "user", content: q },
          ],
        }),
      });
      const json = await res.json();
      const text: string =
        json?.text ||
        json?.message ||
        "Je recommande de standardiser les emails et d'imputer les valeurs manquantes.";
      addAssistant(text);
    } catch {
      // Fallback local
      addAssistant(
        "Je peux normaliser les dates en ISO 8601, formater les téléphones en E.164 et supprimer les doublons. Voulez-vous que je prépare un plan de correction ?"
      );
    } finally {
      setThinking(false);
    }
  }

  // ---- Stats data ------------------------------------------
  const errorCols = useMemo(
    () =>
      colMetrics.filter(
        (m) =>
          m.missingPct > 0.001 ||
          m.duplicatePct > 0.001 ||
          m.invalidPct > 0.001 ||
          m.outlierPct > 0.001 ||
          m.quality < 100
      ),
    [colMetrics]
  );

  const chartMissingRef = useRef<HTMLCanvasElement | null>(null);
  const chartSynthesisRef = useRef<HTMLCanvasElement | null>(null);

  useBarChart(
    chartMissingRef,
    (onlyErrors ? errorCols : colMetrics).map((m) => m.name),
    (onlyErrors ? errorCols : colMetrics).map((m) => Number(m.missingPct.toFixed(2))),
    "Manquants (%)"
  );

  usePieChart(
    chartSynthesisRef,
    ["Manquants", "Doublons", "Invalides", "Outliers"],
    [
      Math.round(colMetrics.reduce((a, b) => a + b.missingPct, 0) / Math.max(1, colMetrics.length)),
      Math.round(colMetrics.reduce((a, b) => a + b.duplicatePct, 0) / Math.max(1, colMetrics.length)),
      Math.round(colMetrics.reduce((a, b) => a + b.invalidPct, 0) / Math.max(1, colMetrics.length)),
      Math.round(colMetrics.reduce((a, b) => a + b.outlierPct, 0) / Math.max(1, colMetrics.length)),
    ],
    "Synthèse erreurs moyennes"
  );

  // ---- Jobs & Schedule -------------------------------------
  function createJob(j: Omit<Job, "id" | "status" | "lastRun" | "nextRun" | "progress">) {
    const id = `job_${Date.now()}`;
    const next = new Date();
    const [hh, mm] = j.time.split(":").map((x) => Number(x));
    next.setHours(hh, mm, 0, 0);
    const job: Job = {
      ...j,
      id,
      status: "pending",
      nextRun: next.toISOString(),
      progress: 0,
    };
    setJobs((js) => [job, ...js]);
  }

  async function dryRun(job: Job) {
    // simulate
    setJobs((js) =>
      js.map((x) => (x.id === job.id ? { ...x, status: "running", progress: 5, lastRun: new Date().toISOString() } : x))
    );
    await sleep(800);
    setJobs((js) => js.map((x) => (x.id === job.id ? { ...x, progress: 45 } : x)));
    await sleep(800);
    // produce CSV from current table or demo
    let out: Table | null = table;
    if (!out || job.source !== "current") {
      // tiny demo
      out = {
        columns: ["email", "amount"],
        rows: [
          { email: "a@ex.com", amount: 10 },
          { email: "b@ex.com", amount: 20 },
        ],
      };
    }
    const csv = toCsv(out);
    const blob = new Blob([csv], { type: "text/csv" });
    const href = URL.createObjectURL(blob);

    setJobs((js) =>
      js.map((x) =>
        x.id === job.id ? { ...x, status: "completed", progress: 100, resultCsvHref: href } : x
      )
    );
  }

  // ---- Downloads -------------------------------------------
  function downloadCleanCSV() {
    if (!table) return;
    const csv = toCsv(table);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName.replace(/\.[^.]+$/, "") + "_clean.csv";
    a.click();
  }
  function downloadJSON() {
    if (!table) return;
    const blob = new Blob([JSON.stringify(table.rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName.replace(/\.[^.]+$/, "") + "_clean.json";
    a.click();
  }

  // ---- UI ---------------------------------------------------
  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="h-wrap">
          <div className="logo">
            <div className="icon">📊</div>
            <div>
              <div style={{ fontWeight: 700 }}>DataClean AI</div>
              <small>Assistant IA pour nettoyage de données d&apos;entreprise</small>
            </div>
          </div>
          <div className="actions">
            <button className="btn">🌐 FR</button>
            <button className="btn primary">👑 Pro</button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <div className="nav">
        <div className="tabs">
          <button className={`tab ${tab === "analyze" ? "active" : ""}`} onClick={() => setTab("analyze")}>
            📊 <strong style={{ marginLeft: 6 }}>Analyser</strong>
          </button>
          <button className={`tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>
            📈 <strong style={{ marginLeft: 6 }}>Statistiques descriptives</strong>
          </button>
          <button className={`tab ${tab === "schedule" ? "active" : ""}`} onClick={() => setTab("schedule")}>
            📅 <strong style={{ marginLeft: 6 }}>Planifier</strong>
          </button>
          <button className={`tab ${tab === "jobs" ? "active" : ""}`} onClick={() => setTab("jobs")}>
            ⚙️ <strong style={{ marginLeft: 6 }}>Jobs</strong>
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="main">
        {/* Content */}
        <main className="panel">
          {/* Analyze */}
          {tab === "analyze" && (
            <div className="grid" style={{ gap: 20 }}>
              {!table && (
                <div
                  className="upload"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFiles(e.dataTransfer.files);
                  }}
                >
                  <div style={{ fontSize: 42, marginBottom: 12 }}>📤</div>
                  <h2>Déposez vos fichiers ou cliquez ici</h2>
                  <p className="muted">CSV, Excel, JSON, TXT</p>
                  <div style={{ marginTop: 12 }} className="row">
                    <span className="tag"><span style={{ width: 8, height: 8, borderRadius: 999, background: "#4ade80" }}></span>Taille max: 50 Mo</span>
                    <span className="tag"><span style={{ width: 8, height: 8, borderRadius: 999, background: "#4a90e2" }}></span>Analyse gratuite - 1000 lignes</span>
                    <span className="tag"><span style={{ width: 8, height: 8, borderRadius: 999, background: "#8b5cf6" }}></span>Traitement local sécurisé</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.json,.txt"
                    style={{ display: "none" }}
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
              )}

              {table && (
                <>
                  {/* KPIs */}
                  <div className="kpis">
                    <div className="k">
                      <div className="muted">Score global</div>
                      <div className="v">{globalScore}%</div>
                    </div>
                    <div className="k">
                      <div className="muted">Doublons supprimés</div>
                      <div className="v">{kpi.dupRemoved}</div>
                    </div>
                    <div className="k">
                      <div className="muted">Manquants corrigés</div>
                      <div className="v">{kpi.missingImputed}</div>
                    </div>
                    <div className="k">
                      <div className="muted">Anomalies détectées</div>
                      <div className="v">{kpi.anomalies}</div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <h3 style={{ margin: 0 }}>Aperçu (1 000 premières lignes max)</h3>
                      <div className="row">
                        <button className="btn" onClick={() => setTable(originalTable)}>
                          Réinitialiser
                        </button>
                        <button className="btn solid" onClick={downloadCleanCSV}>
                          Télécharger CSV propre
                        </button>
                        <button className="btn solid" onClick={downloadJSON}>
                          Télécharger JSON
                        </button>
                      </div>
                    </div>
                    <div style={{ overflow: "auto", border: "1px solid var(--border)", borderRadius: 12, marginTop: 8 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            {table.columns.map((c) => (
                              <th key={c}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.slice((page - 1) * pageSize, page * pageSize).map((r, i) => (
                            <tr key={i}>
                              {table.columns.map((c) => (
                                <td key={c}>{String(r[c] ?? "")}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pagination">
                      <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))}>Préc.</button>
                      <span className="muted">
                        Page {page} / {totalPages}
                      </span>
                      <button className="btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Suiv.</button>
                    </div>
                  </div>

                  {/* Columns with issues */}
                  <div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <h3 style={{ margin: 0 }}>Colonnes avec problèmes</h3>
                      <label className="row">
                        <input
                          type="checkbox"
                          checked={onlyErrors}
                          onChange={(e) => setOnlyErrors(e.target.checked)}
                        />
                        <span className="muted">Afficher uniquement les colonnes en erreur</span>
                      </label>
                    </div>
                    <div className="list">
                      {(onlyErrors ? errorCols : colMetrics).map((m) => (
                        <div className="fix" key={m.name}>
                          <div className="row" style={{ justifyContent: "space-between" }}>
                            <div className="row">
                              <strong style={{ fontSize: 16 }}>{m.name}</strong>
                              <span className="tag">{m.type}</span>
                              <span className="tag">
                                Qualité:{" "}
                                <span className={m.quality >= 90 ? "ok" : m.quality >= 70 ? "warn" : "danger"} style={{ fontWeight: 700 }}>
                                  {Math.round(m.quality)}%
                                </span>
                              </span>
                            </div>
                            <div className="row">
                              <span className="tag">Manquants: {m.missingPct.toFixed(1)}%</span>
                              <span className="tag">Doublons: {m.duplicatePct.toFixed(1)}%</span>
                              <span className="tag">Invalides: {m.invalidPct.toFixed(1)}%</span>
                              {m.outlierPct > 0 ? <span className="tag">Outliers: {m.outlierPct.toFixed(1)}%</span> : null}
                            </div>
                          </div>

                          <div className="row" style={{ flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                            <label className="tag">
                              <input
                                type="checkbox"
                                checked={!!fixPlan[m.name]?.removeDuplicates}
                                onChange={(e) => updateFix(m.name, { removeDuplicates: e.target.checked })}
                              />
                              Supprimer doublons
                            </label>
                            <label className="tag">
                              Imputation:&nbsp;
                              <select
                                className="input"
                                style={{ width: 140, padding: "4px 8px" }}
                                value={fixPlan[m.name]?.impute ?? "none"}
                                onChange={(e) => updateFix(m.name, { impute: e.target.value as FixOptions["impute"] })}
                              >
                                <option value="none">Aucune</option>
                                <option value="mean">Moyenne (num.)</option>
                                <option value="mode">Mode</option>
                              </select>
                            </label>
                            <label className="tag">
                              <input
                                type="checkbox"
                                checked={!!fixPlan[m.name]?.standardize}
                                onChange={(e) => updateFix(m.name, { standardize: e.target.checked })}
                              />
                              Standardiser (format/texte)
                            </label>
                            <label className="tag">
                              <input
                                type="checkbox"
                                checked={!!fixPlan[m.name]?.keep}
                                onChange={(e) => updateFix(m.name, { keep: e.target.checked })}
                              />
                              Garder tel quel
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
                      <div className="log">
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Journal</div>
                        {analysisLog.length === 0 ? (
                          <div className="muted">Aucun message</div>
                        ) : (
                          analysisLog.map((l, i) => <div key={i}>• {l}</div>)
                        )}
                      </div>
                      <button className="btn solid" onClick={applyAllFixes}>
                        ✅ Appliquer toutes les corrections validées
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Stats */}
          {tab === "stats" && (
            <div className="grid" style={{ gap: 16 }}>
              <h2>📈 Statistiques Descriptives</h2>
              {(!table || colMetrics.length === 0) && (
                <p className="muted">Uploadez un fichier dans l&apos;onglet <b>Analyser</b> pour voir les statistiques.</p>
              )}

              {table && (
                <>
                  <div className="cols-2 grid">
                    <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                      <h3>Manquants par colonne</h3>
                      <canvas ref={chartMissingRef} height={120} />
                    </div>
                    <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                      <h3>Synthèse erreurs moyennes</h3>
                      <canvas ref={chartSynthesisRef} height={120} />
                    </div>
                  </div>

                  {/* Basic stats table */}
                  <div>
                    <h3>Tableau récapitulatif</h3>
                    <div style={{ overflow: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Colonne</th>
                            <th>Type</th>
                            <th>Manquants</th>
                            <th>Doublons</th>
                            <th>Invalides</th>
                            <th>Qualité</th>
                          </tr>
                        </thead>
                        <tbody>
                          {colMetrics.map((m) => (
                            <tr key={m.name}>
                              <td>{m.name}</td>
                              <td>{m.type}</td>
                              <td>{m.missingPct.toFixed(1)}%</td>
                              <td>{m.duplicatePct.toFixed(1)}%</td>
                              <td>{m.invalidPct.toFixed(1)}%</td>
                              <td>
                                <span className={m.quality >= 90 ? "ok" : m.quality >= 70 ? "warn" : "danger"}>
                                  {Math.round(m.quality)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Schedule */}
          {tab === "schedule" && (
            <div className="grid" style={{ gap: 12 }}>
              <h2>📅 Planifier</h2>
              <p className="muted">Créez un job récurrent (stocké en local, privacy-first).</p>
              <ScheduleForm onCreate={createJob} />
              <div style={{ height: 6 }} />
              <h3>Jobs planifiés</h3>
              {jobs.length === 0 ? <p className="muted">Aucun job pour le moment.</p> : null}
              <div className="list">
                {jobs.map((j) => (
                  <div key={j.id} className="fix">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div className="row">
                        <strong>{j.name}</strong>
                        <span className="tag">{j.frequency}</span>
                        <span className="tag">⏰ {j.time}</span>
                        <span className="tag">source: {j.source}</span>
                      </div>
                      <div className="row">
                        <span className="tag">statut: {j.status}</span>
                        {j.progress !== undefined ? <span className="tag">progress: {j.progress}%</span> : null}
                        <button className="btn" onClick={() => dryRun(j)}>Dry-run</button>
                      </div>
                    </div>
                    {j.resultCsvHref && (
                      <div style={{ marginTop: 8 }}>
                        <a className="btn solid" href={j.resultCsvHref} download={`${j.name.replace(/\s+/g,"_")}.csv`}>Télécharger résultat</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Jobs */}
          {tab === "jobs" && (
            <div className="grid" style={{ gap: 12 }}>
              <h2>⚙️ Jobs</h2>
              {jobs.length === 0 ? (
                <p className="muted">Rien ici. Créez un job dans l&apos;onglet <b>Planifier</b>.</p>
              ) : (
                <div style={{ overflow: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Statut</th>
                        <th>Dernière exécution</th>
                        <th>Prochaine exécution</th>
                        <th>Progression</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.id}>
                          <td>{j.name}</td>
                          <td>{j.status}</td>
                          <td>{j.lastRun ? new Date(j.lastRun).toLocaleString() : "—"}</td>
                          <td>{j.nextRun ? new Date(j.nextRun).toLocaleString() : "—"}</td>
                          <td>{j.progress ?? 0}%</td>
                          <td>
                            <div className="row">
                              <button className="btn" onClick={() => dryRun(j)}>Tester</button>
                              {j.resultCsvHref && (
                                <a className="btn solid" href={j.resultCsvHref} download={`${j.name.replace(/\s+/g,"_")}.csv`}>
                                  Résultat
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Chat Sidebar */}
        <aside className="sidebar">
          <div className="chat-h">
            <div className="chip">🤖</div>
            <div>
              <div style={{ fontWeight: 700 }}>Assistant IA</div>
              <div className="muted" style={{ fontSize: 12 }}>Expert en nettoyage de données</div>
            </div>
          </div>
          <div className="cm" id="chatMessages">
            {/* Suggested questions */}
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {[
                "Quels sont les doublons détectés ?",
                "Recommande-moi des règles de validation",
                "Explique-moi ces anomalies",
              ].map((q) => (
                <button
                  key={q}
                  className="btn"
                  onClick={() => {
                    setChatInput(q);
                    setTimeout(() => sendChat(), 0);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            {messages.map((m, i) => (
              <div className={`msg ${m.role === "user" ? "user" : ""}`} key={i}>
                <div className={`avatar ${m.role === "assistant" ? "ai" : ""}`}>
                  {m.role === "assistant" ? "🤖" : "👤"}
                </div>
                <div className="bubble">{m.text}</div>
              </div>
            ))}

            {thinking && (
              <div className="muted" style={{ fontSize: 12 }}>L&apos;IA réfléchit…</div>
            )}
          </div>
          <div className="ci">
            <textarea
              className="input"
              rows={1}
              placeholder="Posez votre question sur vos données…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChat();
                }
              }}
            />
            <button className="send" onClick={sendChat}>➤</button>
          </div>
        </aside>
      </div>
    </>
  );
}

// -------------------- Schedule form --------------------------
function ScheduleForm({ onCreate }: { onCreate: (j: Omit<Job, "id" | "status" | "lastRun" | "nextRun" | "progress">) => void }) {
  const [name, setName] = useState("Analyse quotidienne");
  const [frequency, setFrequency] = useState<Job["frequency"]>("daily");
  const [time, setTime] = useState("09:00");
  const [source, setSource] = useState<"current" | "demo" | "url">("current");
  const [url, setUrl] = useState("");

  return (
    <div className="fix">
      <div className="grid cols-3">
        <label className="grid" style={{ gap: 6 }}>
          <span className="muted">Nom du job</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid" style={{ gap: 6 }}>
          <span className="muted">Fréquence</span>
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as any)}>
            <option value="daily">Quotidien</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuel</option>
          </select>
        </label>
        <label className="grid" style={{ gap: 6 }}>
          <span className="muted">Heure</span>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <label className="row">
          <span className="muted">Source:</span>&nbsp;
          <select className="input" value={source} onChange={(e) => setSource(e.target.value as any)}>
            <option value="current">Fichier courant</option>
            <option value="demo">Données démo</option>
            <option value="url">URL publique (CSV/JSON)</option>
          </select>
        </label>
        {source === "url" && (
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="https://exemple.com/data.csv"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
        <button
          className="btn solid"
          onClick={() => onCreate({ name, frequency, time, source, url: source === "url" ? url : undefined })}
        >
          Créer
        </button>
      </div>
    </div>
  );
}
