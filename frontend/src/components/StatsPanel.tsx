import React, { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";

export type Dataset = {
  columns: string[];
  rows: Record<string, any>[];
};

type Props = { dataset?: Dataset };

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

export default function StatsPanel({ dataset }: Props) {
  const barRef = useRef<HTMLCanvasElement | null>(null);
  const pieRef = useRef<HTMLCanvasElement | null>(null);
  const barChart = useRef<Chart | null>(null);
  const pieChart = useRef<Chart | null>(null);

  const stats = useMemo(() => {
    if (!dataset?.rows?.length || !dataset?.columns?.length) {
      return {
        missingPctByCol: [] as { col: string; pct: number }[],
        score: 0,
        anomalies: 0,
        fixedMissing: 0,
        dupRemoved: 0
      };
    }

    const n = dataset.rows.length;
    const missPerCol = dataset.columns.map((c) => {
      let miss = 0;
      for (const r of dataset.rows) {
        const v = r[c];
        if (
          v === null ||
          v === undefined ||
          (typeof v === "string" && v.trim() === "")
        )
          miss++;
      }
      return { col: c, pct: pct(miss, n) };
    });

    // Score simple = 100 - moyenne des manquants
    const avgMiss =
      missPerCol.reduce((s, x) => s + x.pct, 0) / missPerCol.length || 0;
    const score = Math.max(0, 100 - Math.round(avgMiss));

    return {
      missingPctByCol: missPerCol.sort((a, b) => b.pct - a.pct),
      score,
      anomalies: 0,
      fixedMissing: 0,
      dupRemoved: 0
    };
  }, [dataset]);

  useEffect(() => {
    // BAR
    if (barChart.current) barChart.current.destroy();
    if (barRef.current && stats.missingPctByCol.length) {
      const labels = stats.missingPctByCol.map((x) => x.col);
      const data = stats.missingPctByCol.map((x) => x.pct);
      barChart.current = new Chart(barRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [{ label: "% manquants", data }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true, max: 100 }
          }
        }
      });
    }

    // PIE (répartition OK vs manquants)
    if (pieChart.current) pieChart.current.destroy();
    if (pieRef.current && stats.missingPctByCol.length) {
      const avgMiss =
        stats.missingPctByCol.reduce((s, x) => s + x.pct, 0) /
          stats.missingPctByCol.length || 0;
      pieChart.current = new Chart(pieRef.current, {
        type: "pie",
        data: {
          labels: ["Valides", "Manquants (moyenne)"],
          datasets: [
            { data: [Math.max(0, 100 - Math.round(avgMiss)), Math.round(avgMiss)] }
          ]
        }
      });
    }
    // cleanup
    return () => {
      if (barChart.current) barChart.current.destroy();
      if (pieChart.current) pieChart.current.destroy();
    };
  }, [stats]);

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <h2 style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}>
        📊 Statistiques Descriptives
      </h2>

      {!dataset?.rows?.length ? (
        <div style={{ opacity: 0.7 }}>
          Importez & nettoyez un fichier dans l’onglet <b>Analyser</b> pour voir
          les graphiques ici.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16
            }}
          >
            <div className="card">
              <h3>Manquants par colonne</h3>
              <canvas ref={barRef} height={120} />
            </div>
            <div className="card">
              <h3>Synthèse erreurs moyennes</h3>
              <canvas ref={pieRef} height={120} />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 16
            }}
          >
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>
                {stats.score}%
              </div>
              <div>Score global</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800 }}>0%</div>
              <div>Doublons supprimés</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800 }}>0%</div>
              <div>Manquants corrigés</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800 }}>0</div>
              <div>Anomalies détectées</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
