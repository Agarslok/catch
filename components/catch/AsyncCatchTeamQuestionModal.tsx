"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "catch-async-explore-session-id";

export function getAsyncExploreSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

type View = "menu" | "write" | "written_sent" | "oral_sent";

type Props = {
  open: boolean;
  onClose: () => void;
  sectionKey: string;
  sectionLabel: string;
  presentationPointId?: string;
};

async function postAsyncTeamQuestion(body: Record<string, unknown>) {
  const res = await fetch("/api/async/team-question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: getAsyncExploreSessionId(),
      ...body,
    }),
  });
  const data = (await res.json()) as { message?: string; error?: string };
  return { ok: res.ok, message: data.message, error: data.error };
}

export function AsyncCatchTeamQuestionModal({
  open,
  onClose,
  sectionKey,
  sectionLabel,
  presentationPointId,
}: Props) {
  const [view, setView] = useState<View>("menu");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setView("menu");
      setText("");
      setStatus("");
      setSending(false);
    }
  }, [open]);

  if (!open) return null;

  const sendWritten = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setStatus("Enviando…");
    const result = await postAsyncTeamQuestion({
      text: trimmed,
      requestKind: "written_question",
      sectionKey,
      sectionLabel,
      presentationPointId,
    });
    setSending(false);
    if (!result.ok) {
      setStatus(result.error || "No se pudo enviar.");
      return;
    }
    setText("");
    setStatus(result.message || "Pregunta enviada.");
    setView("written_sent");
  };

  const requestCallback = async () => {
    if (sending) return;
    setSending(true);
    setStatus("Enviando…");
    const result = await postAsyncTeamQuestion({
      requestKind: "oral_turn",
      sectionKey,
      sectionLabel,
      presentationPointId,
    });
    setSending(false);
    if (!result.ok) {
      setStatus(result.error || "No se pudo enviar.");
      return;
    }
    setStatus("");
    setView("oral_sent");
  };

  return (
    <div className="catch-modal-veil catch-modal-veil--solid" role="presentation" onClick={onClose}>
      <div
        className="catch-modal catch-modal--solid"
        role="dialog"
        aria-modal="true"
        aria-label="Pregunta al equipo Catch"
        onClick={(e) => e.stopPropagation()}
      >
        {view === "menu" && (
          <>
            <h3>Haz una pregunta al equipo Catch</h3>
            <p className="muted">
              Te responderemos lo antes posible. Relacionada con {sectionLabel}. Elija cómo prefiere
              contactarnos.
            </p>
            <div className="menu-presentador" role="group" aria-label="Opciones de contacto">
              <button type="button" className="opcion-presentador" onClick={() => setView("write")}>
                <span className="ico" aria-hidden="true">+</span>
                <span>
                  <strong>Escribir pregunta</strong>
                  <small>Envíe su duda por escrito al equipo Catch.</small>
                </span>
              </button>
              <button
                type="button"
                className="opcion-presentador opcion-presentador--oral"
                disabled={sending}
                onClick={() => void requestCallback()}
              >
                <span className="ico" aria-hidden="true">🎤</span>
                <span>
                  <strong>Solicitar que me contacten</strong>
                  <small>
                    Pide una llamada o seguimiento en vivo; no activa micrófono en esta pantalla.
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
            <p className="muted">Sección: {sectionLabel}.</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Escriba su pregunta"
              disabled={sending}
            />
            <div className="catch-modal-actions">
              <button type="button" className="ghost ghost--on-light" onClick={() => setView("menu")}>
                Volver
              </button>
              <button
                type="button"
                className="solid solid--on-light"
                disabled={sending}
                onClick={() => void sendWritten()}
              >
                Enviar
              </button>
            </div>
            {status && view === "write" ? <p className="ask-ok">{status}</p> : null}
          </>
        )}

        {view === "written_sent" && (
          <>
            <h3>Pregunta enviada</h3>
            <p className="muted">{status || "El equipo Catch responderá lo antes posible."}</p>
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
              <h3>Solicitud enviada</h3>
              <p>Registramos que desea contacto en vivo. El equipo Catch le responderá pronto.</p>
            </div>
            <div className="catch-modal-actions">
              <button type="button" className="solid solid--on-light" onClick={onClose}>
                Listo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
