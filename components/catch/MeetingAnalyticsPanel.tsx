"use client";

import { useEffect, useState } from "react";
import type { AggregatedMeetingAnalytics } from "@/lib/analytics/aggregate";

type ParticipantEventRow = {
  id: string;
  event_type: string;
  created_at: string;
  chart_id: string | null;
  element_label: string | null;
  metadata: Record<string, unknown>;
};

type Props = {
  meetingId: string;
  active: boolean;
  presenterToken?: string;
};

export function MeetingAnalyticsPanel({ meetingId, active, presenterToken }: Props) {
  const [summary, setSummary] = useState<AggregatedMeetingAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyParticipantId, setHistoryParticipantId] = useState("");
  const [history, setHistory] = useState<ParticipantEventRow[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/meeting/${meetingId}/analytics/summary?role=presenter`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al cargar resumen");
        if (!cancelled) setSummary(data.summary as AggregatedMeetingAnalytics);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, meetingId]);

  if (!active) return null;

  if (loading) return <p className="muted">Cargando analítica de la sesión…</p>;
  if (error) {
    return (
      <p className="muted">
        {error}. ¿Ejecutaste la migración{" "}
        <code>20260314120000_meeting_interaction_analytics.sql</code> en Supabase?
      </p>
    );
  }
  if (!summary) return null;

  const topCharts = Object.entries(summary.charts.views_by_chart_id).sort(
    (a, b) => b[1] - a[1],
  );
  const topElements = summary.elements.top_elements;

  return (
    <div className="analytics-panel">
      <h4>Resumen de interacciones</h4>
      <div className="analytics-grid">
        <div className="analytics-stat">
          <strong>{summary.participation.unique_participants}</strong>
          <span>Participantes únicos</span>
        </div>
        <div className="analytics-stat">
          <strong>{summary.participation.total_events}</strong>
          <span>Eventos totales</span>
        </div>
        <div className="analytics-stat">
          <strong>{summary.actions.by_event_type["element.clicked"] ?? 0}</strong>
          <span>Clics en gráficas</span>
        </div>
        <div className="analytics-stat">
          <strong>{summary.actions.detail_opened}</strong>
          <span>Detalles abiertos</span>
        </div>
        <div className="analytics-stat">
          <strong>{summary.actions.explore_returned}</strong>
          <span>Regresos a presentación</span>
        </div>
      </div>

      <section>
        <h5>Gráficas más vistas</h5>
        {topCharts.length === 0 ? (
          <p className="muted">Sin vistas registradas aún.</p>
        ) : (
          <ul className="analytics-list">
            {topCharts.map(([id, count]) => (
              <li key={id}>
                <code>{id}</code> · {count} eventos ·{" "}
                {summary.charts.unique_participants_by_chart_id[id] ?? 0} participantes
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h5>Elementos más seleccionados</h5>
        {topElements.length === 0 ? (
          <p className="muted">Sin selecciones aún.</p>
        ) : (
          <ul className="analytics-list">
            {topElements.map((el) => (
              <li key={el.element_id}>
                {el.element_label} · {el.event_count} interacciones
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h5>Secuencias frecuentes</h5>
        <ul className="analytics-list">
          {summary.sequences.top_paths.length === 0 ? (
            <li className="muted">Insuficientes eventos para secuencias.</li>
          ) : (
            summary.sequences.top_paths.map((p) => <li key={p}>{p}</li>)
          )}
        </ul>
      </section>

      {presenterToken ? (
        <section>
          <h5>Historial por participante</h5>
          <p className="muted" style={{ margin: "0 0 8px" }}>
            Pegue el <code>participant_id</code> (UUID del ingreso) para ver su línea de tiempo.
          </p>
          <div className="analytics-history-query">
            <input
              type="text"
              value={historyParticipantId}
              onChange={(e) => setHistoryParticipantId(e.target.value)}
              placeholder="participant_id"
              aria-label="ID de participante"
            />
            <button
              type="button"
              className="btn-small"
              onClick={() => {
                const pid = historyParticipantId.trim();
                if (!pid) return;
                setHistoryError(null);
                void fetch(
                  `/api/meeting/${meetingId}/analytics/participant/${encodeURIComponent(pid)}`,
                  { headers: { "x-presenter-token": presenterToken } },
                )
                  .then(async (res) => {
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? "Error al cargar historial");
                    setHistory((data.events ?? []) as ParticipantEventRow[]);
                  })
                  .catch((e) => {
                    setHistory([]);
                    setHistoryError(e instanceof Error ? e.message : "Error");
                  });
              }}
            >
              Cargar historial
            </button>
          </div>
          {historyError ? <p className="muted">{historyError}</p> : null}
          {history.length > 0 ? (
            <ul className="analytics-list analytics-list--timeline">
              {history.map((ev) => (
                <li key={ev.id}>
                  <time dateTime={ev.created_at}>
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </time>
                  <strong>{ev.event_type}</strong>
                  {ev.chart_id ? <span> · {ev.chart_id}</span> : null}
                  {ev.element_label ? <span> · {ev.element_label}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section>
        <h5>Calidad de datos</h5>
        <ul className="analytics-list muted">
          {summary.data_quality.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <p className="analytics-foot muted">
        JSON Sofía:{" "}
        <code>/api/meeting/{meetingId}/analytics/sofia?role=presenter</code>
      </p>
    </div>
  );
}
