"use client";

import { useCallback, useEffect, useState } from "react";
import type { VisitorSessionSummary } from "@/lib/analytics/participant-summaries";
import {
  rosterDurationDisplay,
  rosterEngagementLabel,
  rosterPresenceLabel,
} from "@/lib/meeting/participant-roster-view";

type Props = {
  meetingId: string;
  presenterToken: string;
  active: boolean;
  /** En vivo: solo nombre y estado. En cierre: historial consolidado. */
  showParticipationHistory?: boolean;
  variant?: "rail" | "closing";
};

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function PresenterVisitorRoster({
  meetingId,
  presenterToken,
  active,
  showParticipationHistory = false,
  variant = "rail",
}: Props) {
  const showHistory = showParticipationHistory || variant === "closing";
  const [visitors, setVisitors] = useState<VisitorSessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      const res = await fetch(`/api/meeting/${meetingId}/analytics/participants`, {
        headers: { "x-presenter-token": presenterToken },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar participantes");
      setVisitors((data.visitors ?? []) as VisitorSessionSummary[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar participantes");
    }
  }, [active, meetingId, presenterToken]);

  useEffect(() => {
    void refresh();
    if (!active) return;
    const pollMs = showHistory ? 15000 : 8000;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [active, refresh, showHistory]);

  if (!active) return null;

  const heading = showHistory ? "Historial de participación" : "Participantes";

  return (
    <section
      className={`visitor-roster${variant === "closing" ? " visitor-roster--closing" : ""}`}
      aria-label={heading}
    >
      <h4 className="visitor-roster__heading">{heading}</h4>
      {showHistory ? (
        <p className="muted visitor-roster__lead">
          Resumen al cierre de la reunión. Los datos provienen de registros de sesión y eventos en
          Supabase. Los clics son los persistidos en el servidor; no se reconstruyen toques locales
          anteriores.
        </p>
      ) : (
        <p className="muted visitor-roster__lead">
          Estado de conexión, preguntas y clics por persona (datos en Supabase). El historial
          detallado aparece al finalizar la reunión.
        </p>
      )}
      {error ? <p className="muted">{error}</p> : null}
      {visitors.length === 0 && !error ? (
        <p className="muted">Aún no hay visitantes registrados con actividad.</p>
      ) : null}
      <ul className="visitor-roster__list">
        {visitors.map((v) => {
          const duration = rosterDurationDisplay(v, showHistory);
          const presence = rosterPresenceLabel(v, showHistory);
          return (
            <li key={v.participant_id} className="visitor-roster__card">
              <p className="visitor-roster__name">{v.display_name}</p>
              <p
                className={`visitor-roster__status${v.presence === "connected" && !showHistory ? " visitor-roster__status--on" : ""}`}
              >
                {presence}
              </p>
              {!showHistory ? (
                <p className="visitor-roster__meta muted">{rosterEngagementLabel(v)}</p>
              ) : null}
              {duration.kind === "confirmed" ? (
                <p className="visitor-roster__duration">Permanencia: {duration.label}</p>
              ) : null}
              {duration.kind === "unconfirmed" ? (
                <p className="visitor-roster__duration muted">{duration.message}</p>
              ) : null}
              {showHistory ? (
                <>
                  <p className="visitor-roster__times">
                    Ingreso {formatClock(v.joined_at)}
                    {v.left_at ? ` · Salida ${formatClock(v.left_at)}` : ""}
                  </p>
                  {v.sections.length > 0 ? (
                    <p className="visitor-roster__sections">
                      Intereses / secciones: {v.sections.join(" · ")}
                    </p>
                  ) : (
                    <p className="visitor-roster__sections muted">
                      Sin secciones registradas en eventos
                    </p>
                  )}
                  <p className="visitor-roster__meta muted">
                    {v.questions_asked} pregunta{v.questions_asked === 1 ? "" : "s"} · {v.clicks}{" "}
                    clic{v.clicks === 1 ? "" : "s"}
                  </p>
                  {v.clarity_votes && v.clarity_votes.length > 0 ? (
                    <ul className="visitor-roster__clarity">
                      {v.clarity_votes.map((cv, i) => (
                        <li key={`${cv.section_key}-${cv.vote}-${i}`}>
                          {cv.section_key}: {cv.label}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="visitor-roster__sections muted">Sin votos de claridad registrados</p>
                  )}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
