import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { formatISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ---- Chart.js lazy import (fiable en build Vite/Vercel) ----
let ChartLib: any = null;
async function getChart() {
  if (ChartLib) return ChartLib;
  const m = await import("chart.js/auto");
  ChartLib = m.default || m;
  return ChartLib;
}

// ------------------- Types -------------------
type Row = Record<string, any>;

type ColumnIssue = {
  name: string;
  type: DetectedType;
  missingPct: number;
  duplicatePct: number;
  invalidPct: number;
  outlierPct: number;
  score: number; // 0-100
  suggestions: CorrectionSuggestion[];
};

type DetectedType =
  | "number"
  | "text"
  | "date"
  | "email"
  | "phone"
  | "url"
  | "boolean"
  | "iban"
  | "unknown";

type CorrectionSuggestion =
  | { key: "dedupe"; label: string; selected: boolean }
  | { key: "impute_mean"; label: string; selected: boolean }
  | { key: "impute_mode"; label: string; selected: boolean }
  | { key: "std_email"; label: string; selected: boolean }
  | { key: "std_date_iso"; label: string; selected: boolean }
  | { key: "std_phone_e164"; label: string; selected: boolean }
  | { key: "normalize_text"; label: string; selected: boolean }
  | { key: "keep"; label: string; selected: boolean };

type Analysis = {
  columns: ColumnIssue[];
  issues: ColumnIssue[]; // uniquement colonnes en erreur
  scoreGlobal: number;
  kpi: { duplicatesRemoved: number; missingCorrected: number; anomalies: number };
};

type Job = {
  id: string;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  time: string; // HH:mm
  source: "current" | "demo" | "url";
  url?: string;
  status: "running" | "completed" | "pending" | "failed";
  nextRun: string;
  lastRun?: string;
};

// ------------------- Utils -------------------
const MAX_PREVIEW = 1000;
const PAGE_SIZE = 25;
const FILE_MAX_MB = 50;

// Email simple RFC-like
const EMAIL_RE =
  /^(?:[a-zA-Z0-9_'^&/+-])+(?:\.(?:[a-zA-Z0-9_'^&/+-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
// URL via WHATWG sera plus solide côté backend; ici simple test
const URL_RE =
  /^(https?:\/\/)?([^\s$.?#].[^\s]*)$/i;
// IBAN checksum
function isValidIBAN(ibanRaw: string) {
  const iban = (ibanRaw || "").replace(/[\s-]/g, "").toUpperCase();
  if (!iban || iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const converted = rearranged
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String(code - 55);
      if (code >= 48 && code <= 57) return ch;
      return "";
    })
    .join("");
  // mod 97
  let remainder = "";
  for (let i = 0; i < converted.length; i += 7) {
    const part = remainder + converted.substring(i, i + 7);
    remainder = String(parseInt(part, 10) % 97);
  }
  return Number(remainder) === 1;
}

function isDateVal(v: any) {
  if (v === null || v === undefined || v === "") return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}

function toISODate(v: any) {
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return formatISO(d);
}

function normalizeText(v: any) {
  if (v == null) return v;
  return String(v)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function mode<T>(arr: T[]): T | undefined {
  const counts = new Map<T, number>();
  arr.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let max = 0;
  let res: T | undefined = undefined;
  counts.forEach((c, val) => {
    if (c > max) {
      max = c;
      res = val;
    }
  });
  return res;
}

function zScores(nums: number[]) {
  if (nums.length < 3) return nums.map(() => 0);
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance =
    nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (nums.length - 1);
  const sd = Math.sqrt(variance || 1);
  return nums.map((n) => (n - mean) / (sd || 1));
}

// Export helpers
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

async function downloadZip(files: { name: string; blob: Blob }[]) {
  // zip minimal sans lib : utilise une “fake zip” ? Non → petite dépendance manquante.
  // Ici, on livre un workaround simple: on propose 2 téléchargements séquentiels si l’API Zip n’est pas dispo.
  // Vercel static → on reste simple & fiable.
  for (const f of files) downloadBlob(f.blob, f.name);
}

// .ics minimal
function makeICS(job: Job) {
  const dt = new Date();
  const [h, m] = job.time.split(":").map(Number);
  dt.setHours(h || 9, m || 0, 0, 0);

  let rrule = "";
  if (job.frequency === "daily") rrule = "FREQ=DAILY";
  if (job.frequency === "weekly") rrule = "FREQ=WEEKLY";
  if (job.frequency === "monthly") rrule = "FREQ=MONTHLY";

  const dtstamp = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//DataClean AI//FR
BEGIN:VEVENT
UID:${job.id}
DTSTAMP:${dtstamp}
DTSTART:${dtstamp}
RRULE:${rrule}
SUMMARY:DataClean - ${job.name}
DESCRIPTION:Job planifié (${job.frequency}) à ${job.time}
END:VEVENT
END:VCALENDAR`;
  return new Blob([ics], { type: "text/calendar;charset=utf-8" });
}

// --------------- Composant principal ---------------
export default function App() {
  // Onglets
  const [tab, setTab] = useState<"analyze" | "stats" | "schedule" | "jobs">(
    "analyze"
  );

  // Dataset
  const [rawRows, setRawRows] = useState<Row[] | null>(null);
  const [cleanRows, setCleanRows] = useState<Row[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [sheetNames, setSheetNames] = useState<string[] | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

  // Preview
  const [page, setPage] = useState(1);

  // Analyse
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [progress, setProgress] = useState<
    "" | "lecture" | "structure" | "anomalies" | "metriques" | "insights"
  >("");

  // Corrections log
  const [logCorrections, setLogCorrections] = useState<string[]>([]);

  // Stats (Chart.js instances)
  const statsChart1 = useRef<any>(null);
  const statsChart2 = useRef<any>(null);

  // Jobs
  const [jobs, setJobs] = useState<Job[]>(() => {
    const s = localStorage.getItem("dc_jobs");
    return s ? JSON.parse(s) : [];
  });

  // Chat latéral
  const [messages, setMessages] = useState<
    { role: "ai" | "user"; content: string }[]
  >([
    {
      role: "ai",
      content:
        "Salut ! Je suis votre assistant IA spécialisé en nettoyage de données. Uploadez un fichier et je vous aiderai à l'analyser !",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);

  // ---------------- Fichier: parsing ----------------
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > FILE_MAX_MB * 1024 * 1024) {
      alert(`Fichier trop volumineux (> ${FILE_MAX_MB} Mo)`);
      return;
    }

    setProgress("lecture");

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    try {
      if (["csv", "txt"].includes(ext)) {
        const text = await file.text();
        const parsed = Papa.parse<Row>(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
        });
        const rows = parsed.data;
        await afterLoad(rows);
      } else if (["xlsx", "xls"].includes(ext)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        setSheetNames(wb.SheetNames);
        const sh = wb.SheetNames[0];
        setSelectedSheet(sh);
        const ws = wb.Sheets[sh];
        const rows: Row[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        await afterLoad(rows);
      } else if (ext === "json") {
        const text = await file.text();
        const json = JSON.parse(text);
        const rows: Row[] = Array.isArray(json) ? json : json.data || [];
        await afterLoad(rows);
      } else {
        alert("Format non supporté (CSV, Excel, JSON, TXT)");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur de lecture du fichier.");
      setProgress("");
    }
  }

  async function afterLoad(rows: Row[]) {
    const limited = rows.slice(0, MAX_PREVIEW);
    const cols =
      limited.length > 0 ? Object.keys(limited[0]) : ([] as string[]);
    setRawRows(limited);
    setCleanRows(limited.map((r) => ({ ...r })));
    setColumns(cols);
    setPage(1);

    // Analyse pipeline
    setProgress("structure");
    await sleep(500);
    const a1 = detectAndScore(limited, cols);

    setProgress("anomalies");
    await sleep(500);
    // (déjà inclus dans detectAndScore: invalidPct/outliers)

    setProgress("metriques");
    await sleep(500);

    setProgress("insights");
    const scoreGlobal = Math.round(
      a1.columns.reduce((acc, c) => acc + c.score, 0) / Math.max(1, a1.columns.length)
    );
    const issues = a1.columns.filter(
      (c) =>
        c.missingPct > 0 ||
        c.duplicatePct > 0 ||
        c.invalidPct > 0 ||
        c.outlierPct > 0
    );
    const analysisFinal: Analysis = {
      columns: a1.columns,
      issues,
      scoreGlobal,
      kpi: {
        duplicatesRemoved: 0,
        missingCorrected: 0,
        anomalies: Math.round(
          issues.reduce((acc, c) => acc + c.invalidPct + c.outlierPct, 0)
        ),
      },
    };
    setAnalysis(analysisFinal);
    setProgress("");
  }

  function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // ---------- Détection types + métriques ----------
  function detectType(values: any[]): DetectedType {
    const sample = values.slice(0, 100).filter((v) => v !== "" && v != null);
    if (sample.length === 0) return "unknown";

    let numOK = 0,
      dateOK = 0,
      emailOK = 0,
      phoneOK = 0,
      urlOK = 0,
      boolOK = 0,
      ibanOK = 0;

    for (const v of sample) {
      const s = String(v).trim();
      if (!Number.isNaN(Number(s)) && s !== "") numOK++;
      if (isDateVal(s)) dateOK++;
      if (EMAIL_RE.test(s)) emailOK++;
      if (parsePhoneNumberFromString(s || "", "FR")) phoneOK++;
      if (URL_RE.test(s)) urlOK++;
      if (["true", "false", "oui", "non", "0", "1"].includes(s.toLowerCase()))
        boolOK++;
      if (isValidIBAN(s)) ibanOK++;
    }
    const n = sample.length;
    if (ibanOK / n > 0.6) return "iban";
    if (emailOK / n > 0.6) return "email";
    if (phoneOK / n > 0.6) return "phone";
    if (urlOK / n > 0.6) return "url";
    if (boolOK / n > 0.6) return "boolean";
    if (dateOK / n > 0.6) return "date";
    if (numOK / n > 0.6) return "number";
    return "text";
  }

  function detectAndScore(rows: Row[], cols: string[]) {
    const total = rows.length || 1;
    const colIssues: ColumnIssue[] = cols.map((name) => {
      const values = rows.map((r) => r[name]);
      const missing = values.filter((v) => v === "" || v == null).length;
      const missingPct = Math.round((missing / total) * 100);

      // duplicates
      const seen = new Set<string>();
      let dupCount = 0;
      for (const v of values) {
        const key = String(v ?? "");
        if (key === "") continue;
        if (seen.has(key)) dupCount++;
        else seen.add(key);
      }
      const duplicatePct = Math.round((dupCount / total) * 100);

      // type + invalids
      const dtype = detectType(values);
      let invalid = 0;
      let numVals: number[] = [];
      for (const v of values) {
        const s = String(v ?? "").trim();
        if (s === "") continue;
        switch (dtype) {
          case "email":
            if (!EMAIL_RE.test(s)) invalid++;
            break;
          case "phone":
            if (!parsePhoneNumberFromString(s || "", "FR")) invalid++;
            break;
          case "url":
            if (!URL_RE.test(s)) invalid++;
            break;
          case "iban":
            if (!isValidIBAN(s)) invalid++;
            break;
          case "date":
            if (!isDateVal(s)) invalid++;
            break;
          case "boolean":
            if (
              !["true", "false", "oui", "non", "0", "1"].includes(
                s.toLowerCase()
              )
            )
              invalid++;
            break;
          case "number":
            if (Number.isNaN(Number(s))) invalid++;
            else numVals.push(Number(s));
            break;
          default:
            break;
        }
      }
      const invalidPct = Math.round((invalid / total) * 100);

      // outliers (z-score > 3) only on number
      let outlierPct = 0;
      if (dtype === "number" && numVals.length > 3) {
        const zs = zScores(numVals);
        const outs = zs.filter((z) => Math.abs(z) > 3).length;
        outlierPct = Math.round((outs / total) * 100);
      }

      // score simple: 100 - (0.5*missing + 0.3*invalid + 0.2*duplicate)
      const score = Math.max(
        0,
        Math.round(100 - (0.5 * missingPct + 0.3 * invalidPct + 0.2 * duplicatePct))
      );

      const suggestions: CorrectionSuggestion[] = [
        { key: "dedupe", label: "Supprimer doublons", selected: duplicatePct > 0 },
        { key: "impute_mean", label: "Imputer manquants (moyenne)", selected: dtype === "number" && missingPct > 0 },
        { key: "impute_mode", label: "Imputer manquants (mode)", selected: dtype !== "number" && missingPct > 0 },
        { key: "std_email", label: "Standardiser emails", selected: dtype === "email" && invalidPct > 0 },
        { key: "std_date_iso", label: "Dates en ISO 8601", selected: dtype === "date" && invalidPct > 0 },
        { key: "std_phone_e164", label: "Téléphones en E.164", selected: dtype === "phone" && invalidPct > 0 },
        { key: "normalize_text", label: "Normaliser texte (trim/accents)", selected: dtype === "text" },
        { key: "keep", label: "Garder tel quel", selected: false },
      ];

      return {
        name,
        type: dtype,
        missingPct,
        duplicatePct,
        invalidPct,
        outlierPct,
        score,
        suggestions,
      };
    });

    return { columns: colIssues };
  }

  // --------------- Application corrections ---------------
  function toggleSuggestion(colName: string, key: CorrectionSuggestion["key"]) {
    if (!analysis) return;
    const nextCols = analysis.columns.map((c) => {
      if (c.name !== colName) return c;
      const next = c.suggestions.map((s) =>
        s.key === key ? { ...s, selected: !s.selected } : s
      );
      return { ...c, suggestions: next };
    });
    const issues = nextCols.filter(
      (c) =>
        c.missingPct > 0 ||
        c.duplicatePct > 0 ||
        c.invalidPct > 0 ||
        c.outlierPct > 0
    );
    setAnalysis({
      ...analysis,
      columns: nextCols,
      issues,
    });
  }

  function applyAllCorrections() {
    if (!analysis || !cleanRows || !rawRows) return;
    let rows = [...cleanRows];

    const logs: string[] = [];

    for (const col of analysis.columns) {
      const selected = col.suggestions
        .filter((s) => s.selected && s.key !== "keep")
        .map((s) => s.key);

      if (selected.length === 0) continue;

      // DEDUPE
      if (selected.includes("dedupe")) {
        const seen = new Set<string>();
        const deduped: Row[] = [];
        for (const r of rows) {
          const key = String(r[col.name] ?? "");
          if (key === "" || !seen.has(key)) {
            deduped.push(r);
            if (key !== "") seen.add(key);
          }
        }
        logs.push(`✔️ Doublons supprimés sur "${col.name}" : ${rows.length - deduped.length}`);
        rows = deduped;
      }

      // IMPUTE MISSING
      if (selected.includes("impute_mean")) {
        const nums = rows
          .map((r) => Number(r[col.name]))
          .filter((v) => !Number.isNaN(v));
        const mean =
          nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length);
        rows = rows.map((r) => {
          if (r[col.name] === "" || r[col.name] == null)
            return { ...r, [col.name]: Math.round((mean + Number.EPSILON) * 1000) / 1000 };
          return r;
        });
        logs.push(`✔️ Imputation moyenne sur "${col.name}"`);
      }
      if (selected.includes("impute_mode")) {
        const vals = rows
          .map((r) => r[col.name])
          .filter((v) => v !== "" && v != null);
        const m = mode(vals);
        if (m !== undefined) {
          rows = rows.map((r) => {
            if (r[col.name] === "" || r[col.name] == null)
              return { ...r, [col.name]: m };
            return r;
          });
          logs.push(`✔️ Imputation mode sur "${col.name}"`);
        }
      }

      // STANDARDIZATIONS
      if (selected.includes("std_email")) {
        rows = rows.map((r) => {
          const v = r[col.name];
          if (v == null || v === "") return r;
          const s = String(v).trim().toLowerCase();
          return EMAIL_RE.test(s) ? { ...r, [col.name]: s } : r;
        });
        logs.push(`✔️ Emails standardisés sur "${col.name}"`);
      }

      if (selected.includes("std_date_iso")) {
        rows = rows.map((r) => {
          const v = r[col.name];
          if (v == null || v === "") return r;
          if (isDateVal(v)) return { ...r, [col.name]: toISODate(v) };
          return r;
        });
        logs.push(`✔️ Dates ISO 8601 sur "${col.name}"`);
      }

      if (selected.includes("std_phone_e164")) {
        rows = rows.map((r) => {
          const v = r[col.name];
          if (v == null || v === "") return r;
          const ph = parsePhoneNumberFromString(String(v), "FR");
          if (ph && ph.isValid()) return { ...r, [col.name]: ph.number };
          return r;
        });
        logs.push(`✔️ Téléphones E.164 sur "${col.name}"`);
      }

      if (selected.includes("normalize_text")) {
        rows = rows.map((r) => {
          const v = r[col.name];
          if (v == null) return r;
          return { ...r, [col.name]: normalizeText(v) };
        });
        logs.push(`✔️ Texte normalisé sur "${col.name}"`);
      }
    }

    setCleanRows(rows);
    setLogCorrections((prev) => [...prev, ...logs]);

    // Recalcule analyse post-corrections (rapide)
    const cols = columns;
    const a1 = detectAndScore(rows, cols);
    const scoreGlobal = Math.round(
      a1.columns.reduce((acc, c) => acc + c.score, 0) / Math.max(1, a1.columns.length)
    );
    const issues = a1.columns.filter(
      (c) =>
        c.missingPct > 0 ||
        c.duplicatePct > 0 ||
        c.invalidPct > 0 ||
        c.outlierPct > 0
    );
    setAnalysis({
      columns: a1.columns,
      issues,
      scoreGlobal,
      kpi: {
        duplicatesRemoved: 0, // calcul précis possible : ici résumé léger
        missingCorrected: 0,
        anomalies: Math.round(
          issues.reduce((acc, c) => acc + c.invalidPct + c.outlierPct, 0)
        ),
      },
    });
  }

  // --------------- Export ----------------
  function exportCSV() {
    if (!cleanRows) return;
    const csv = Papa.unparse(cleanRows);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "dataclean_clean.csv");
  }

  function exportExcel() {
    if (!cleanRows) return;
    const ws = XLSX.utils.json_to_sheet(cleanRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cleaned");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "dataclean_clean.xlsx");
  }

  function exportPDF() {
    if (!analysis) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Rapport DataClean - Avant/Après", 14, 16);
    doc.setFontSize(11);
    doc.text(`Score global: ${analysis.scoreGlobal}%`, 14, 24);

    const rows =
      analysis.columns.map((c) => [
        c.name,
        c.type,
        `${c.missingPct}%`,
        `${c.duplicatePct}%`,
        `${c.invalidPct}%`,
        `${c.score}`,
      ]) || [];

    autoTable(doc, {
      startY: 30,
      head: [["Colonne", "Type", "% Manquants", "% Doublons", "% Invalides", "Score"]],
      body: rows,
    });

    doc.save("dataclean_report.pdf");
  }

  function exportAll() {
    const blobs: { name: string; blob: Blob }[] = [];
    if (cleanRows) {
      const csv = Papa.unparse(cleanRows);
      blobs.push({
        name: "dataclean_clean.csv",
        blob: new Blob([csv], { type: "text/csv;charset=utf-8" }),
      });

      const ws = XLSX.utils.json_to_sheet(cleanRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cleaned");
      const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      blobs.push({
        name: "dataclean_clean.xlsx",
        blob: new Blob([out], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      });
    }
    if (analysis) {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("Rapport DataClean", 14, 16);
      doc.setFontSize(11);
      doc.text(`Score global: ${analysis.scoreGlobal}%`, 14, 24);
      const rows =
        analysis.columns.map((c) => [
          c.name,
          c.type,
          `${c.missingPct}%`,
          `${c.duplicatePct}%`,
          `${c.invalidPct}%`,
          `${c.score}`,
        ]) || [];
      autoTable(doc, {
        startY: 30,
        head: [["Colonne", "Type", "% Manquants", "% Doublons", "% Invalides", "Score"]],
        body: rows,
      });
      blobs.push({
        name: "dataclean_report.pdf",
        blob: doc.output("blob"),
      });
    }
    if (blobs.length === 0) return;
    // Fallback multi-download (voir note dans downloadZip)
    downloadZip(blobs);
  }

  // --------------- Stats (charts) ----------------
  useEffect(() => {
    (async () => {
      if (!analysis) return;
      const Chart = await getChart();
      const ctx1 = (document.getElementById("chart1") as HTMLCanvasElement | null)?.getContext("2d");
      const ctx2 = (document.getElementById("chart2") as HTMLCanvasElement | null)?.getContext("2d");
      const labels = analysis.issues.map((c) => c.name);
      const dataMissing = analysis.issues.map((c) => c.missingPct);

      if (ctx1) {
        statsChart1.current?.destroy?.();
        statsChart1.current = new Chart(ctx1, {
          type: "bar",
          data: {
            labels,
            datasets: [{ label: "% Manquants", data: dataMissing }],
          },
        });
      }
      if (ctx2) {
        statsChart2.current?.destroy?.();
        const avgDup =
          Math.round(
            analysis.issues.reduce((a, c) => a + c.duplicatePct, 0) /
              Math.max(1, analysis.issues.length)
          ) || 0;
        const avgInv =
          Math.round(
            analysis.issues.reduce((a, c) => a + c.invalidPct, 0) /
              Math.max(1, analysis.issues.length)
          ) || 0;
        const avgOut =
          Math.round(
            analysis.issues.reduce((a, c) => a + c.outlierPct, 0) /
              Math.max(1, analysis.issues.length)
          ) || 0;

        statsChart2.current = new Chart(ctx2, {
          type: "pie",
          data: {
            labels: ["Doublons", "Invalides", "Outliers"],
            datasets: [{ data: [avgDup, avgInv, avgOut] }],
          },
        });
      }
    })();

    return () => {
      statsChart1.current?.destroy?.();
      statsChart2.current?.destroy?.();
    };
  }, [analysis]);

  // --------------- Jobs / Schedule (localStorage) ---------------
  useEffect(() => {
    localStorage.setItem("dc_jobs", JSON.stringify(jobs));
  }, [jobs]);

  function addJob(j: Omit<Job, "id" | "status" | "nextRun">) {
    const id = `job_${Date.now()}`;
    const nextRun = new Date().toISOString();
    const job: Job = { id, status: "pending", nextRun, ...j };
    setJobs((prev) => [job, ...prev]);
  }

  function dryRun(job: Job) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id
          ? {
              ...j,
              status: "running",
            }
          : j
      )
    );
    setTimeout(() => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: "completed",
                lastRun: new Date().toLocaleString(),
              }
            : j
        )
      );
    }, 1200);
  }

  // --------------- Chat IA ----------------
  async function sendChat() {
    if (!chatInput.trim() || thinking) return;
    const userMsg = { role: "user" as const, content: chatInput.trim() };
    setMessages((m) => [...m, userMsg]);
    setChatInput("");
    setThinking(true);

    // Tente l’API /api/chat (Vercel) sinon DEMO
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Tu es un assistant de nettoyage de données." },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userMsg.content },
          ],
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const aiText =
        data?.reply ||
        data?.choices?.[0]?.message?.content ||
        "D'accord. Décris-moi ta colonne à corriger, et je te propose une action.";
      setMessages((m) => [...m, { role: "ai", content: aiText }]);
    } catch {
      // DEMO fallback
      const answers = [
        "Je recommande de standardiser les emails et d'imputer les valeurs manquantes.",
        "On peut supprimer les doublons basés sur email et téléphone.",
        "Je peux normaliser les dates en ISO 8601 et formater les téléphones en E.164.",
        "Souhaitez-vous que j'applique mes corrections automatiquement ?",
      ];
      const aiText = answers[Math.floor(Math.random() * answers.length)];
      setMessages((m) => [...m, { role: "ai", content: aiText }]);
    } finally {
      setThinking(false);
    }
  }

  // --------------- RENDU UI ---------------
  const pageRows = useMemo(() => {
    if (!cleanRows) return [];
    const start = (page - 1) * PAGE_SIZE;
    return cleanRows.slice(start, start + PAGE_SIZE);
  }, [cleanRows, page]);

  function resetAll() {
    setRawRows(null);
    setCleanRows(null);
    setColumns([]);
    setAnalysis(null);
    setLogCorrections([]);
    setSheetNames(null);
    setSelectedSheet(null);
    setPage(1);
  }

  return (
    <div style={styles.body}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>📊</div>
            <div>
              <div style={styles.logoText}>DataClean AI</div>
              <div style={styles.logoSub}>Assistant IA pour nettoyage de données d'entreprise</div>
            </div>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.langBtn}>🌐 FR</button>
            <a href="#" style={styles.proBadge}>👑 Pro</a>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={styles.navContainer}>
        <nav style={styles.navTabs as any}>
          {[
            { id: "analyze", label: "📊 Analyser", key: "analyze" },
            { id: "stats", label: "📈 Statistiques descriptives", key: "stats" },
            { id: "schedule", label: "📅 Planifier", key: "schedule" },
            { id: "jobs", label: "⚙️ Jobs", key: "jobs" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.key as any)}
              style={{
                ...styles.navTab,
                ...(tab === t.key ? styles.navTabActive : {}),
              }}
            >
              <strong>{t.label}</strong>
            </button>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div style={styles.main}>
        {/* Content */}
        <main style={styles.content}>
          {/* ANALYZE */}
          {tab === "analyze" && (
            <>
              {!rawRows && (
                <div
                  style={styles.uploadArea}
                  onClick={() => document.getElementById("fileInput")?.click()}
                >
                  <div style={styles.uploadIcon}>📤</div>
                  <h2 style={styles.uploadTitle}>Déposez vos fichiers ou cliquez ici</h2>
                  <p style={styles.uploadSubtitle}>CSV, Excel, JSON, TXT</p>

                  <div style={styles.uploadFeatures}>
                    <div style={styles.feature}>
                      <div style={{ ...styles.featureDot, background: "#4ade80" }} />
                      <span>Taille max: 50 Mo</span>
                    </div>
                    <div style={styles.feature}>
                      <div style={{ ...styles.featureDot, background: "#4a90e2" }} />
                      <span>Analyse gratuite - 1000 lignes</span>
                    </div>
                    <div style={styles.feature}>
                      <div style={{ ...styles.featureDot, background: "#a855f7" }} />
                      <span>🔒 Vos données restent dans votre navigateur</span>
                    </div>
                  </div>

                  <input
                    id="fileInput"
                    type="file"
                    accept=".csv,.xlsx,.xls,.json,.txt"
                    multiple={false}
                    style={{ display: "none" }}
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
              )}

              {/* Progress */}
              {progress && (
                <div style={{ marginTop: 24, color: "rgba(255,255,255,.8)" }}>
                  {progress === "lecture" && "🤖 Lecture du fichier..."}
                  {progress === "structure" && "🤖 Analyse de la structure..."}
                  {progress === "anomalies" && "🤖 Détection des anomalies..."}
                  {progress === "metriques" && "🤖 Calcul des métriques..."}
                  {progress === "insights" && "🤖 Génération des insights..."}
                </div>
              )}

              {/* Sheet selector for Excel */}
              {sheetNames && selectedSheet && (
                <div style={{ marginTop: 16 }}>
                  <label>Feuille Excel : </label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    style={{ padding: "6px 8px", background: "#111827", color: "#fff", border: "1px solid #374151", borderRadius: 6 }}
                  >
                    {sheetNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Preview + Score + Issues */}
              {rawRows && analysis && (
                <>
                  {/* Score global */}
                  <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={styles.scoreCircle}>
                      <div style={styles.scoreValue}>{analysis.scoreGlobal}%</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Score</div>
                    </div>
                    <button onClick={resetAll} style={styles.resetBtn}>🔄 Nouveau fichier</button>
                  </div>

                  {/* Table preview */}
                  <div style={{ marginTop: 16, overflow: "auto", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ background: "rgba(255,255,255,.05)" }}>
                        <tr>
                          {columns.map((c) => (
                            <th key={c} style={styles.th}>
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((r, i) => (
                          <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                            {columns.map((c) => (
                              <td key={c} style={styles.td}>
                                {String(r[c] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      style={styles.pageBtn}
                      disabled={page <= 1}
                    >
                      ◀
                    </button>
                    <div style={{ opacity: 0.7 }}>Page {page}</div>
                    <button
                      onClick={() =>
                        setPage((p) =>
                          cleanRows ? (p * PAGE_SIZE < cleanRows.length ? p + 1 : p) : p
                        )
                      }
                      style={styles.pageBtn}
                      disabled={!cleanRows || page * PAGE_SIZE >= cleanRows.length}
                    >
                      ▶
                    </button>
                  </div>

                  {/* Issues only */}
                  <div style={{ marginTop: 24 }}>
                    <h3 style={{ marginBottom: 8 }}>Colonnes avec erreurs</h3>
                    {analysis.issues.length === 0 && (
                      <div style={{ opacity: 0.8 }}>Aucune erreur détectée 🎉</div>
                    )}
                    <div style={{ display: "grid", gap: 12 }}>
                      {analysis.issues.map((col) => (
                        <div
                          key={col.name}
                          style={{
                            border: "1px solid rgba(255,255,255,.12)",
                            borderRadius: 12,
                            padding: 12,
                            background: "rgba(255,255,255,.03)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <strong>{col.name}</strong>
                              <span style={chip}>{col.type}</span>
                              <span style={chipMuted}>Score: {col.score}</span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <span style={chipWarn}>Manquants {col.missingPct}%</span>
                              <span style={chipWarn}>Doublons {col.duplicatePct}%</span>
                              <span style={chipWarn}>Invalides {col.invalidPct}%</span>
                            </div>
                          </div>

                          {/* Suggestions */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {col.suggestions.map((s) => (
                              <button
                                key={s.key}
                                onClick={() => toggleSuggestion(col.name, s.key)}
                                style={{
                                  ...suggestionBtn,
                                  ...(s.selected ? suggestionBtnOn : {}),
                                }}
                              >
                                {s.selected ? "✅ " : ""} {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions globales */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                    <button onClick={applyAllCorrections} style={primaryBtn}>
                      ✅ Appliquer toutes les corrections sélectionnées
                    </button>
                    <button onClick={exportCSV} style={secBtn}>
                      ⬇️ Export CSV
                    </button>
                    <button onClick={exportExcel} style={secBtn}>
                      ⬇️ Export Excel
                    </button>
                    <button onClick={exportPDF} style={secBtn}>
                      ⬇️ Rapport PDF
                    </button>
                    <button onClick={exportAll} style={secBtn}>
                      ⬇️ Télécharger tout
                    </button>
                  </div>

                  {/* Journal des corrections */}
                  {logCorrections.length > 0 && (
                    <div
                      style={{
                        marginTop: 16,
                        border: "1px solid rgba(255,255,255,.12)",
                        borderRadius: 12,
                        padding: 12,
                        background: "rgba(34,197,94,.08)",
                      }}
                    >
                      <h4 style={{ marginBottom: 8 }}>Corrections appliquées</h4>
                      <ul>
                        {logCorrections.map((l, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>
                            {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* STATS */}
          {tab === "stats" && (
            <div>
              <h2>📈 Statistiques Descriptives</h2>
              {!analysis ? (
                <p style={{ marginTop: 12, opacity: 0.8 }}>
                  Importez et nettoyez un dataset dans l'onglet <strong>Analyser</strong> pour voir
                  ici les distributions et comparatifs avant/après.
                </p>
              ) : (
                <>
                  <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
                    <div style={card}>
                      <h4 style={{ marginBottom: 8 }}>Manquants par colonne</h4>
                      <canvas id="chart1" height={120}></canvas>
                    </div>
                    <div style={card}>
                      <h4 style={{ marginBottom: 8 }}>Synthèse erreurs moyennes</h4>
                      <canvas id="chart2" height={120}></canvas>
                    </div>
                  </div>

                  {/* Quelques métriques */}
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 16 }}>
                    <div style={metricCard}>
                      <div style={metricValue}>{analysis.scoreGlobal}%</div>
                      <div style={metricLabel}>Score global</div>
                    </div>
                    <div style={metricCard}>
                      <div style={metricValue}>{analysis.kpi.duplicatesRemoved}%</div>
                      <div style={metricLabel}>Doublons supprimés</div>
                    </div>
                    <div style={metricCard}>
                      <div style={metricValue}>{analysis.kpi.missingCorrected}%</div>
                      <div style={metricLabel}>Manquants corrigés</div>
                    </div>
                    <div style={metricCard}>
                      <div style={metricValue}>{analysis.kpi.anomalies}</div>
                      <div style={metricLabel}>Anomalies détectées</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SCHEDULE */}
          {tab === "schedule" && (
            <div>
              <h2>📅 Planifier</h2>
              <p style={{ marginTop: 8, opacity: 0.8 }}>
                Créez des jobs planifiés (stockés localement dans votre navigateur).
              </p>

              <ScheduleForm
                onCreate={(j) => addJob(j)}
                onICS={(j) => {
                  const blob = makeICS(j as Job);
                  downloadBlob(blob, "dataclean_job.ics");
                }}
              />

              <div style={{ marginTop: 16 }}>
                <h3>Jobs planifiés</h3>
                {jobs.length === 0 ? (
                  <div style={{ opacity: 0.8, marginTop: 8 }}>Aucun job planifié</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {jobs.map((job) => (
                      <div key={job.id} style={jobRow}>
                        <div>
                          <strong>{job.name}</strong>
                          <div style={{ opacity: 0.7, fontSize: 12 }}>
                            {job.frequency} — {job.time} — {job.source}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={statusChip(job.status)}>{job.status}</span>
                          <button onClick={() => dryRun(job)} style={smallBtn}>
                            ▶ Dry-run
                          </button>
                          <button
                            onClick={() =>
                              setJobs((prev) => prev.filter((j) => j.id !== job.id))
                            }
                            style={smallDanger}
                          >
                            🗑 Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* JOBS */}
          {tab === "jobs" && (
            <div>
              <h2>⚙️ Jobs</h2>
              {jobs.length === 0 ? (
                <p style={{ marginTop: 8, opacity: 0.8 }}>
                  Ayez d’abord des jobs dans <strong>Planifier</strong>.
                </p>
              ) : (
                <table style={{ marginTop: 12, width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "rgba(255,255,255,.05)" }}>
                    <tr>
                      <th style={th}>Job</th>
                      <th style={th}>Statut</th>
                      <th style={th}>Dernière exécution</th>
                      <th style={th}>Prochaine exécution</th>
                      <th style={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                        <td style={td}>{j.name}</td>
                        <td style={td}>
                          <span style={statusChip(j.status)}>{j.status}</span>
                        </td>
                        <td style={td}>{j.lastRun || "-"}</td>
                        <td style={td}>{new Date(j.nextRun).toLocaleString()}</td>
                        <td style={td}>
                          <button onClick={() => dryRun(j)} style={smallBtn}>
                            ▶ Lancer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </main>

        {/* Sidebar Chat */}
        <aside style={styles.sidebar}>
          <div style={styles.chatHeader}>
            <div style={styles.assistantIcon}>🤖</div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Assistant IA</h3>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                Expert en nettoyage de données
              </p>
            </div>
          </div>

          <div id="chatMessages" style={styles.chatMessages}>
            {/* Suggested questions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {[
                "Comment nettoyer cette colonne ?",
                "Quels sont les doublons détectés ?",
                "Recommande-moi des règles de validation",
                "Explique-moi ces anomalies",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setChatInput(q);
                    setTimeout(() => sendChat(), 0);
                  }}
                  style={suggestedBtn}
                >
                  {q}
                </button>
              ))}
            </div>

            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, ...(m.role === "user" ? { flexDirection: "row-reverse" } : {}) }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    background:
                      m.role === "ai"
                        ? "linear-gradient(135deg, #8b5cf6, #a855f7)"
                        : "#4a90e2",
                  }}
                >
                  {m.role === "ai" ? "🤖" : "👤"}
                </div>
                <div
                  style={{
                    background:
                      m.role === "ai"
                        ? "rgba(255,255,255,.06)"
                        : "#4a90e2",
                    color: m.role === "ai" ? "#fff" : "#fff",
                    padding: "8px 10px",
                    borderRadius: 12,
                    maxWidth: 220,
                    fontSize: 13.5,
                    lineHeight: 1.35,
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.chatFooter}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Posez votre question sur vos données..."
                rows={1}
                style={chatInputStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
              />
              <button onClick={sendChat} disabled={thinking || !chatInput.trim()} style={sendBtn}>
                ➤
              </button>
            </div>
            {thinking && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, opacity: 0.7 }}>
                L'IA réfléchit
                <div style={{ display: "flex", gap: 3 }}>
                  <Dot />
                  <Dot delay="0.2s" />
                  <Dot delay="0.4s" />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ----------------- Sous-composants -----------------
function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <div
      style={{
        width: 4,
        height: 4,
        borderRadius: 999,
        background: "#8b5cf6",
        animation: "dc-typing 1.4s infinite",
        animationDelay: delay,
      }}
    />
  );
}

function ScheduleForm({
  onCreate,
  onICS,
}: {
  onCreate: (j: Omit<Job, "id" | "status" | "nextRun">) => void;
  onICS: (j: Omit<Job, "id" | "status" | "nextRun">) => void;
}) {
  const [name, setName] = useState("Analyse CRM quotidienne");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
    "daily"
  );
  const [time, setTime] = useState("09:00");
  const [source, setSource] = useState<"current" | "demo" | "url">("current");
  const [url, setUrl] = useState("");

  return (
    <div style={{ ...card, marginTop: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Créer un job</h3>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <label>Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
        </div>
        <div>
          <label>Fréquence</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as any)}
            style={select}
          >
            <option value="daily">Quotidien</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuel</option>
          </select>
        </div>
        <div>
          <label>Heure</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={input}
          />
        </div>
        <div>
          <label>Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            style={select}
          >
            <option value="current">Fichier courant</option>
            <option value="demo">Données démo</option>
            <option value="url">URL publique (CSV/JSON)</option>
          </select>
        </div>
        {source === "url" && (
          <div style={{ gridColumn: "1 / span 2" }}>
            <label>URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemple.com/data.csv"
              style={input}
            />
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          style={primaryBtn}
          onClick={() =>
            onCreate({ name, frequency, time, source, url: url || undefined })
          }
        >
          ➕ Créer
        </button>
        <button
          style={secBtn}
          onClick={() =>
            onICS({ name, frequency, time, source, url: url || undefined } as any)
          }
        >
          📆 Export .ICS
        </button>
      </div>
    </div>
  );
}

// ----------------- Styles inline (sobres & sombres) -----------------
const styles: Record<string, React.CSSProperties> = {
  body: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: "#1a1a2e",
    color: "#ffffff",
    minHeight: "100vh",
  },
  header: {
    background: "#1a1a2e",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255,255,255,.1)",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  headerContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: 1400,
    margin: "0 auto",
  },
  logo: { display: "flex", alignItems: "center", gap: 12, fontWeight: 600 },
  logoIcon: {
    width: 36,
    height: 36,
    background: "#4a90e2",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 18,
  },
  logoText: { fontSize: 18, color: "#fff" },
  logoSub: { fontSize: 12, color: "rgba(255,255,255,.6)" },
  headerActions: { display: "flex", gap: 12, alignItems: "center" },
  langBtn: {
    background: "rgba(255,255,255,.1)",
    border: "1px solid rgba(255,255,255,.2)",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },
  proBadge: {
    background: "#ff8c00",
    padding: "6px 10px",
    borderRadius: 6,
    color: "#fff",
    textDecoration: "none",
    fontWeight: 600,
  },
  navContainer: {
    background: "#1a1a2e",
    borderBottom: "1px solid rgba(255,255,255,.1)",
    padding: "0 24px",
  },
  navTabs: {
    display: "flex",
    gap: 0,
    maxWidth: 1400,
    margin: "0 auto",
  },
  navTab: {
    padding: "14px 18px",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,.7)",
    cursor: "pointer",
    fontWeight: 500,
    borderBottom: "3px solid transparent",
    fontSize: 14,
  },
  navTabActive: {
    color: "#4a90e2",
    borderBottomColor: "#4a90e2",
    background: "rgba(74,144,226,.05)",
  },
  main: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: 24,
    display: "flex",
    gap: 24,
  },
  content: {
    flex: 1,
    background: "rgba(255,255,255,.03)",
    borderRadius: 16,
    padding: 24,
    border: "1px solid rgba(255,255,255,.1)",
  },
  sidebar: {
    width: 320,
    background: "rgba(255,255,255,.03)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.1)",
    height: 600,
    display: "flex",
    flexDirection: "column",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottom: "1px solid rgba(255,255,255,.1)",
  },
  assistantIcon: {
    width: 32,
    height: 32,
    background: "linear-gradient(135deg, #8b5cf6, #a855f7)",
    borderRadius: 8,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: 12,
    display: "flex",
    flexDirection: "column",
  },
  chatFooter: {
    padding: 12,
    borderTop: "1px solid rgba(255,255,255,.1)",
  },
  uploadArea: {
    border: "2px dashed rgba(255,255,255,.3)",
    borderRadius: 12,
    padding: "64px 24px",
    textAlign: "center" as const,
    background: "rgba(255,255,255,.02)",
    cursor: "pointer",
  },
  uploadIcon: {
    width: 64,
    height: 64,
    background: "#4a90e2",
    borderRadius: 12,
    margin: "0 auto 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 24,
  },
  uploadTitle: { fontSize: 20, fontWeight: 600, marginBottom: 6 },
  uploadSubtitle: { fontSize: 14, opacity: 0.8, marginBottom: 16 },
  uploadFeatures: {
    display: "flex",
    justifyContent: "center",
    gap: 24,
    fontSize: 13,
    flexWrap: "wrap" as const,
  },
  feature: { display: "flex", alignItems: "center", gap: 8 },
  featureDot: { width: 8, height: 8, borderRadius: 999 },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: "50%",
    border: "4px solid rgba(74,144,226,.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(74,144,226,.08)",
    flexDirection: "column",
  },
  scoreValue: { fontSize: 28, fontWeight: 800, color: "#4ade80" },
  resetBtn: {
    background: "#374151",
    border: "1px solid #4b5563",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
};

const th: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 13,
  color: "rgba(255,255,255,.9)",
};
const td: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  color: "#fff",
};
const chip: React.CSSProperties = {
  background: "rgba(74,144,226,.15)",
  border: "1px solid rgba(74,144,226,.4)",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
};
const chipMuted: React.CSSProperties = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.15)",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
};
const chipWarn: React.CSSProperties = {
  background: "rgba(234,179,8,.15)",
  border: "1px solid rgba(234,179,8,.4)",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
};

const suggestionBtn: React.CSSProperties = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.15)",
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 12.5,
  cursor: "pointer",
};
const suggestionBtnOn: React.CSSProperties = {
  background: "rgba(34,197,94,.18)",
  border: "1px solid rgba(34,197,94,.5)",
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(90deg, #2563eb, #7c3aed)",
  border: "none",
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 10,
  fontWeight: 600,
  cursor: "pointer",
};
const secBtn: React.CSSProperties = {
  background: "#4b5563",
  border: "1px solid #6b7280",
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 10,
  fontWeight: 600,
  cursor: "pointer",
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 12,
  padding: 12,
};

const metricCard: React.CSSProperties = {
  ...card,
  textAlign: "center",
};
const metricValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#4ade80",
};
const metricLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
};

const pageBtn: React.CSSProperties = {
  background: "#374151",
  border: "1px solid #4b5563",
  color: "#fff",
  padding: "6px 8px",
  borderRadius: 6,
  cursor: "pointer",
};

const jobRow: React.CSSProperties = {
  ...card,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

function statusChip(s: Job["status"]): React.CSSProperties {
  const base = {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid",
  } as React.CSSProperties;
  if (s === "running") return { ...base, background: "rgba(59,130,246,.15)", borderColor: "rgba(59,130,246,.5)" };
  if (s === "completed") return { ...base, background: "rgba(34,197,94,.15)", borderColor: "rgba(34,197,94,.5)" };
  if (s === "pending") return { ...base, background: "rgba(234,179,8,.15)", borderColor: "rgba(234,179,8,.5)" };
  return { ...base, background: "rgba(239,68,68,.15)", borderColor: "rgba(239,68,68,.5)" };
}

const smallBtn: React.CSSProperties = {
  background: "#374151",
  border: "1px solid #4b5563",
  color: "#fff",
  padding: "6px 8px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
};
const smallDanger: React.CSSProperties = {
  ...smallBtn,
  background: "#7f1d1d",
  borderColor: "#b91c1c",
};

const input: React.CSSProperties = {
  width: "100%",
  background: "#111827",
  border: "1px solid #374151",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 10px",
  marginTop: 6,
};
const select: React.CSSProperties = { ...input };

const chatInputStyle: React.CSSProperties = {
  flex: 1,
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.2)",
  borderRadius: 12,
  padding: "8px 10px",
  color: "#fff",
  fontSize: 13,
  resize: "none",
  minHeight: 40,
  maxHeight: 100,
};

const sendBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  background: "#4a90e2",
  border: "none",
  borderRadius: "50%",
  color: "#fff",
  cursor: "pointer",
  fontSize: 16,
};

const suggestedBtn: React.CSSProperties = {
  background: "rgba(74,144,226,.1)",
  border: "1px solid rgba(74,144,226,.3)",
  color: "#4a90e2",
  padding: "6px 8px",
  borderRadius: 8,
  fontSize: 12.5,
  textAlign: "left" as const,
  cursor: "pointer",
};

// ---- petite anim CSS pour les 3 points du typing ----
const style = document.createElement("style");
style.innerHTML = `
@keyframes dc-typing {
  0%,60%,100% { opacity: .3 }
  30% { opacity: 1 }
}
`;
document.head.appendChild(style);
