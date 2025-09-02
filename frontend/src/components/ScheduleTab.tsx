import React, { useEffect, useState } from "react";

export type Job = {
  id: string;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  time: string; // "09:00"
  source: "current" | "demo" | "url";
  url?: string;
  nextRun?: string; // ISO
  lastDryRun?: string; // ISO
};

const LS_KEY = "dca_schedules_v1";

function load(): Job[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function save(items: Job[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function toICS(job: Job) {
  const now = new Date();
  const [h, m] = job.time.split(":").map(Number);
  const dt = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  );
  const dtStart = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const freq = job.frequency.toUpperCase();
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//DataClean AI//Schedule//FR
BEGIN:VEVENT
UID:${job.id}
DTSTAMP:${dtStart}
DTSTART:${dtStart}
RRULE:FREQ=${freq}
SUMMARY:${job.name}
DESCRIPTION:Planification DataClean AI
END:VEVENT
END:VCALENDAR`.trim();
}

export default function SchedulePanel() {
  const [items, setItems] = useState<Job[]>([]);
  const [name, setName] = useState("Analyse CRM quotidienne");
  const [frequency, setFrequency] = useState<Job["frequency"]>("daily");
  const [time, setTime] = useState("09:00");
  const [source, setSource] = useState<Job["source"]>("current");
  const [url, setUrl] = useState("");

  useEffect(() => setItems(load()), []);

  function add() {
    const j: Job = {
      id: crypto.randomUUID(),
      name,
      frequency,
      time,
      source,
      url: source === "url" ? url : undefined
    };
    const next = [...items, j];
    setItems(next);
    save(next);
  }

  function remove(id: string) {
    const next = items.filter((x) => x.id !== id);
    setItems(next);
    save(next);
  }

  function dryRun(job: Job) {
    const next = items.map((x) =>
      x.id === job.id ? { ...x, lastDryRun: new Date().toISOString() } : x
    );
    setItems(next);
    save(next);
    alert("Dry-run lancé (simulation). En version Pro : exécution serveur & alertes.");
  }

  function downloadICS(job: Job) {
    const ics = toICS(job);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = job.name.replace(/\s+/g, "_") + ".ics";
    a.click();
  }

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <h2 style={{ fontSize: 24 }}>📅 Planifier</h2>

      <div
        className="card"
        style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}
      >
        <div>
          <label>Nom du job</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Analyse CRM quotidienne"
            style={inputStyle}
          />
        </div>
        <div>
          <label>Fréquence</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as any)}
            style={inputStyle}
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
            style={inputStyle}
          />
        </div>
        <div>
          <label>Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            style={inputStyle}
          >
            <option value="current">Fichier courant</option>
            <option value="demo">Données démo</option>
            <option value="url">URL CSV/JSON</option>
          </select>
          {source === "url" && (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              style={{ ...inputStyle, marginTop: 8 }}
            />
          )}
        </div>

        <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
          <button className="btn" onClick={add}>
            Créer
          </button>
          <button
            className="btn"
            onClick={() =>
              alert(
                "Fonctionnalités Pro : exécution 24/7 côté serveur, alertes email/webhooks, stockage cloud."
              )
            }
          >
            Pro requis
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Jobs planifiés</h3>
        {!items.length ? (
          <div style={{ opacity: 0.7 }}>Aucun job. Créez votre premier job.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((j) => (
              <div
                key={j.id}
                className="card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center"
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{j.name}</div>
                  <div style={{ opacity: 0.7, fontSize: 13 }}>
                    {j.frequency} — {j.time} — source: {j.source}
                    {j.url ? ` (${j.url})` : ""}
                    {j.lastDryRun ? ` — dernier dry-run: ${new Date(j.lastDryRun).toLocaleString()}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => dryRun(j)}>
                    Dry-run
                  </button>
                  <button className="btn" onClick={() => downloadICS(j)}>
                    Export .ICS
                  </button>
                  <button className="btn danger" onClick={() => remove(j.id)}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.06)",
  color: "#e5e7eb",
  outline: "none"
};
