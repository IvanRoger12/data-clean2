import React, { useEffect, useState } from "react";

type HistoryItem = {
  id: string;
  name: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  durationMs?: number;
  downloadUrl?: string;
};

const LS_HISTORY = "dca_jobs_history_v1";

function loadHist(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
  } catch {
    return [];
  }
}
function saveHist(items: HistoryItem[]) {
  localStorage.setItem(LS_HISTORY, JSON.stringify(items));
}

export default function JobsPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => setItems(loadHist()), []);

  function simulateRun() {
    const id = crypto.randomUUID();
    const job: HistoryItem = {
      id,
      name: "Analyse manuelle",
      status: "running",
      startedAt: new Date().toISOString()
    };
    const next = [job, ...items];
    setItems(next);
    saveHist(next);

    // Finir en "completed"
    setTimeout(() => {
      const ended = next.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "completed",
              durationMs: 3200,
              downloadUrl: undefined // tu peux mettre une URL de ton export ici
            }
          : x
      );
      setItems(ended);
      saveHist(ended);
    }, 1800);
  }

  function clear() {
    setItems([]);
    saveHist([]);
  }

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <h2 style={{ fontSize: 24 }}>⚙️ Jobs</h2>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={simulateRun}>
          Lancer un test
        </button>
        <button className="btn danger" onClick={clear}>
          Vider l’historique
        </button>
      </div>

      {!items.length ? (
        <div style={{ opacity: 0.7 }}>Aucun job pour l’instant.</div>
      ) : (
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.7 }}>
                <th>Job</th>
                <th>Statut</th>
                <th>Début</th>
                <th>Durée</th>
                <th>Téléchargement</th>
              </tr>
            </thead>
            <tbody>
              {items.map((j) => (
                <tr key={j.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                  <td>{j.name}</td>
                  <td>{j.status}</td>
                  <td>{new Date(j.startedAt).toLocaleString()}</td>
                  <td>{j.durationMs ? Math.round(j.durationMs / 1000) + "s" : "-"}</td>
                  <td>
                    {j.downloadUrl ? (
                      <a className="btn" href={j.downloadUrl}>
                        Télécharger
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
