"use client";

import { useCallback, useEffect, useState } from "react";
import type { VisitorSessionSummary } from "@/lib/analytics/participant-summaries";

type Props = {
  meetingId: string;
  presenterToken: string;
  active: boolean;
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
  variant = "rail",
}: Props) {
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
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [active, refresh]);

  if (!active) return null;

  return (
    <section
      className={`visitor-roster${variant === "closing" ? " visitor-roster--closing" : ""}`}
      aria-label="Participantes de la sesión"
    >
      <h4 className="visitor-roster__heading">Participantes</h4>
      {error ? <p className="muted">{error}</p> : null}
      {visitors.length === 0 && !error ? (
        <p className="muted">Aún no hay visitantes registrados con actividad.</p>
      ) : null}
      <ul className="visitor-roster__list">
        {visitors.map((v) => (
          <li key={v.participant_id} className="visitor-roster__card">
            <p className="visitor-roster__name">{v.display_name}</p>
            <p className="visitor-roster__duration">{v.duration_label}</p>
            <p className="visitor-roster__times">
              Ingreso {formatClock(v.joined_at)}
              {v.left_at ? ` · Salida ${formatClock(v.left_at)}` : " · En sesión"}
            </p>
            {v.sections.length > 0 ? (
              <p className="visitor-roster__sections">
                {v.sections.slice(0, 3).join(" · ")}
              </p>
            ) : (
              <p className="visitor-roster__sections muted">Sin secciones exploradas aún</p>
            )}
            <p className="visitor-roster__meta muted">
              {v.questions_asked} pregunta{v.questions_asked === 1 ? "" : "s"} · {v.clicks} clic
              {v.clicks === 1 ? "" : "s"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
