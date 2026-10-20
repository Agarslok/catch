"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeetingQuestionRow } from "@/lib/meeting/session-types";

type View = "menu" | "write" | "written_sent" | "oral_sent";

type Props = {
  meetingId: string;
  participantId: string;
  participantToken: string;
  sectionKey: string;
  sectionLabel: string;
  presentationPointId?: string;
  open: boolean;
  onClose: () => void;
  /** Tras turno oral desde claridad: explorar la sección sin perder la cola. */
  fromClarity?: boolean;
  /** Tras enviar pregunta escrita o turno oral (p. ej. registrar voto «duda» en claridad). */
  onQueueSubmitted?: () => void;
  onExploreAfterOral?: () => void;
};

export function ParticipantModeratorAskModal({
  meetingId,
  participantId,
  participantToken,
  sectionKey,
  sectionLabel,
  presentationPointId,
  open,
  onClose,
  fromClarity = false,
  onQueueSubmitted,
  onExploreAfterOral,
}: Props) {
  const [view, setView] = useState<View>("menu");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<MeetingQuestionRow[]>([]);

  useEffect(() => {
    if (!open) {
      setView("menu");
      setText("");
      setStatus("");
      setBusy(false);
    }
  }, [open]);

  const refresh = useCallback(async () => {
    if (!open || !participantToken) return;
    const res = await fetch(`/api/meeting/${meetingId}/questions`, {
      headers: {
        "x-participant-id": participantId,
        "x-participant-token": participantToken,
      },
    });
    if (!res.ok) return;
    const data = await res.json();
    setMine((data.questions ?? []) as MeetingQuestionRow[]);
  }, [open, participantToken, meetingId, participantId]);

  useEffect(() => {
    void refresh();
    if (!open) return;
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [open, refresh]);

  const postQueue = async (payload: Record<string, unknown>) => {
    const res = await fetch(`/api/meeting/${meetingId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantToken,
        participantId,
        sectionKey,
        sectionLabel,
        presentationPointId,
        source: fromClarity ? "clarity_modal" : "live_meeting_app",
        ...payload,
      }),
    });
    return res.ok;
  };

  const sendWritten = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setStatus("Enviando…");
    const ok = await postQueue({
      text: trimmed,
      requestKind: "written_question",
    });
    setBusy(false);
    if (!ok) {
      setStatus("No se pudo enviar.");
      return;
    }
    setText("");
    setView("written_sent");
    setStatus("");
    onQueueSubmitted?.();
    void refresh();
  };

  const requestOralTurn = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Enviando solicitud…");
    const ok = await postQueue({
      requestKind: "oral_turn",
      idempotencyKey: `oral:${sectionKey}:${participantId}`,
    });
    setBusy(false);
    if (!ok) {
      setStatus("No se pudo solicitar turno.");
      return;
    }
    setStatus("");
    setView("oral_sent");
    onQueueSubmitted?.();
    void refresh();
  };

  if (!open) return null;

  return (
    <div className="catch-modal-veil catch-modal-veil--solid" role="presentation" onClick={onClose}>
      <div
        className="catch-modal catch-modal--solid"
        role="dialog"
        aria-modal="true"
        aria-label="Preguntar al presentador"
        onClick={(e) => e.stopPropagation()}
      >
        {view === "menu" && (
          <>
            <h3>Preguntar al presentador</h3>
            <p className="muted nota-anon">
              La reunión de voz es externa. Aquí solo avisa al moderador cómo quiere participar.
              Relacionado con {sectionLabel}.
            </p>
            <div className="menu-presentador" role="group" aria-label="Opciones para el presentador">
              <button
                type="button"
                className="opcion-presentador"
                onClick={() => setView("write")}
              >
                <span className="ico" aria-hidden="true">+</span>
                <span>
                  <strong>Escribir pregunta</strong>
                  <small>Envía un mensaje escrito a la cola del moderador.</small>
                </span>
              </button>
              <button
                type="button"
                className="opcion-presentador opcion-presentador--oral"
                disabled={busy}
                onClick={() => void requestOralTurn()}
              >
                <span className="ico" aria-hidden="true">🎤</span>
                <span>
                  <strong>Solicitar turno oral</strong>
                  <small>
                    No activa el micrófono aquí. Solo pide turno para hablar en la reunión externa.
                  </small>
                </span>
              </button>
            </div>
            {status ? <p className="ask-ok">{status}</p> : null}
            <div className="catch-modal-actions">
              <button type="button" className="ghost ghost--on-light" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        )}

        {view === "write" && (
          <>
            <h3>Escribir pregunta</h3>
            <p className="muted">
              Solo usted y el moderador la ven. Sección: {sectionLabel}.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Escriba su pregunta"
              disabled={busy}
            />
            <div className="catch-modal-actions">
              <button type="button" className="ghost ghost--on-light" onClick={() => setView("menu")}>
                Volver
              </button>
              <button
                type="button"
                className="solid solid--on-light"
                disabled={busy}
                onClick={() => void sendWritten()}
              >
                Enviar pregunta
              </button>
            </div>
            {status ? <p className="ask-ok">{status}</p> : null}
          </>
        )}

        {view === "written_sent" && (
          <>
            <h3>Pregunta enviada</h3>
            <p className="muted">Entró en la cola del moderador. Puede seguir la presentación.</p>
            <div className="catch-modal-actions">
              <button type="button" className="solid solid--on-light" onClick={onClose}>
                Listo
              </button>
            </div>
          </>
        )}

        {view === "oral_sent" && (
          <>
            <div className="confirm-turno">
              <div className="ok-mark" aria-hidden="true">✓</div>
              <h3>Turno solicitado</h3>
              <p>Su solicitud de turno fue enviada al presentador.</p>
              <p className="muted nota-anon">
                No se usa el micrófono de este dispositivo. Cuando le toque, podrá hablar en la reunión
                externa.
              </p>
              {fromClarity ? (
                <p className="muted">
                  Mientras espera, puede recorrer los gráficos de esta sección sin perder su lugar en la
                  cola oral.
                </p>
              ) : null}
            </div>
            <div className="catch-modal-actions">
              {fromClarity && onExploreAfterOral ? (
                <button
                  type="button"
                  className="solid solid--on-light"
                  onClick={() => {
                    onExploreAfterOral();
                    onClose();
                  }}
                >
                  Explorar la sección
                </button>
              ) : null}
              <button type="button" className="ghost ghost--on-light" onClick={onClose}>
                Listo
              </button>
            </div>
          </>
        )}

        {view === "menu" && mine.length > 0 && (
          <>
            <h4 className="analytics-subhead">Sus solicitudes recientes</h4>
            <ul className="engagement-list engagement-list--compact">
              {mine.slice(0, 4).map((q) => (
                <li key={q.id}>
                  <div className="meta">
                    {q.request_kind === "oral_turn" ? "Turno oral" : "Pregunta"} · {q.section_label}
                  </div>
                  {q.text ? <p>{q.text}</p> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
