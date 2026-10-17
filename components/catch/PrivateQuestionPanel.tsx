"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeetingQuestionRow } from "@/lib/meeting/session-types";

type Props = {
  meetingId: string;
  participantId: string;
  participantToken: string;
  sectionKey: string;
  sectionLabel: string;
  presentationPointId?: string;
  open: boolean;
  onClose: () => void;
};

export function PrivateQuestionPanel({
  meetingId,
  participantId,
  participantToken,
  sectionKey,
  sectionLabel,
  presentationPointId,
  open,
  onClose,
}: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState<MeetingQuestionRow[]>([]);

  const headers = useCallback(
    () => ({
      "x-participant-id": participantId,
      "x-participant-token": participantToken,
    }),
    [participantId, participantToken],
  );

  const refresh = useCallback(async () => {
    if (!open || !participantToken) return;
    const res = await fetch(`/api/meeting/${meetingId}/questions`, { headers: headers() });
    if (!res.ok) return;
    const data = await res.json();
    setMine((data.questions ?? []) as MeetingQuestionRow[]);
  }, [open, participantToken, meetingId, headers]);

  useEffect(() => {
    void refresh();
    if (!open) return;
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [open, refresh]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatus("Enviando…");
    const res = await fetch(`/api/meeting/${meetingId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: trimmed,
        participantToken,
        sectionKey,
        sectionLabel,
        presentationPointId,
        requestKind: "written_question",
        source: "live_meeting_app",
      }),
    });
    if (!res.ok) {
      setStatus("No se pudo enviar.");
      return;
    }
    setText("");
    setStatus("Pregunta enviada. Solo usted y el moderador la ven.");
    void refresh();
  };

  if (!open) return null;

  return (
    <div className="catch-modal-veil" role="presentation" onClick={onClose}>
      <div
        className="catch-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Preguntas privadas"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Pregunta privada al moderador</h3>
        <p className="muted">
          Otros participantes no ven este mensaje. Relacionada con {sectionLabel}.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={600}
          placeholder="Escriba su pregunta"
        />
        <div className="catch-modal-actions">
          <button type="button" className="ghost ghost--on-light" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="solid solid--on-light" onClick={() => void send()}>
            Enviar
          </button>
        </div>
        {status && <p className="ask-ok">{status}</p>}
        <h4 className="analytics-subhead">Sus preguntas</h4>
        <ul className="engagement-list">
          {mine.length === 0 && <li className="muted">Aún no ha enviado preguntas.</li>}
          {mine.map((q) => (
            <li key={q.id} className={q.status === "answered" ? "answered" : ""}>
              <div className="meta">
                {q.section_label} ·{" "}
                {new Date(q.created_at).toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <p>{q.text}</p>
              {q.answer_text && <div className="engagement-answer">{q.answer_text}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
