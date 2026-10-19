"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MeetingQuestionRow, MeetingQueueRequestKind } from "@/lib/meeting/session-types";
import { CHAPTERS } from "@/lib/data/guanajuato-2026";

type Props = {
  meetingId: string;
  presenterToken: string;
  active: boolean;
  /** Oculta la pestaña de claridad en vivo; los votos siguen registrándose en el flujo del visitante. */
  showClarityTab?: boolean;
};

type ClaritySummary = Record<
  string,
  { claro: number; duda: number; glosario: number; explorar: number }
>;

const KIND_LABEL: Record<MeetingQueueRequestKind, string> = {
  written_question: "Pregunta escrita",
  assistant_to_presenter: "Asistente → presentador",
  ai_escalation: "Escalación desde asistente",
  oral_turn: "Turno oral solicitado",
  clarity_doubt: "Duda (claridad)",
};

function sortQueue(rows: MeetingQuestionRow[]) {
  const rank = (s: string) => (s === "open" ? 0 : 1);
  return [...rows].sort((a, b) => {
    const dr = rank(a.status) - rank(b.status);
    if (dr !== 0) return dr;
    const ta = Date.parse(a.created_at);
    const tb = Date.parse(b.created_at);
    return a.status === "open" ? ta - tb : tb - ta;
  });
}

export function PresenterEngagementPanel({
  meetingId,
  presenterToken,
  active,
  showClarityTab = false,
}: Props) {
  const [tab, setTab] = useState<"preguntas" | "claridad">("preguntas");
  const [questions, setQuestions] = useState<MeetingQuestionRow[]>([]);
  const [clarity, setClarity] = useState<ClaritySummary>({});
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const headers = useMemo(
    () => ({ "x-presenter-token": presenterToken }),
    [presenterToken],
  );

  const refresh = useCallback(async () => {
    if (!active) return;
    setError("");
    const qRes = await fetch(`/api/meeting/${meetingId}/questions`, { headers });
    if (qRes.ok) {
      const data = await qRes.json();
      setQuestions(sortQueue((data.questions ?? []) as MeetingQuestionRow[]));
    } else if (qRes.status === 503) {
      setError("Configure SUPABASE_SERVICE_ROLE_KEY para ver la cola del moderador.");
    }
    if (showClarityTab) {
      const cRes = await fetch(`/api/meeting/${meetingId}/clarity`, { headers });
      if (cRes.ok) {
        const data = await cRes.json();
        setClarity((data.summary ?? {}) as ClaritySummary);
      }
    }
  }, [active, meetingId, headers, showClarityTab]);

  useEffect(() => {
    void refresh();
    if (!active) return;
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [active, refresh]);

  const patchItem = async (questionId: string, body: Record<string, string>) => {
    const res = await fetch(`/api/meeting/${meetingId}/questions/${questionId}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) void refresh();
  };

  const publishAnswer = async (questionId: string) => {
    const answerText = (answerDraft[questionId] ?? "").trim();
    if (!answerText) return;
    await patchItem(questionId, { answerText });
    setAnswerDraft((d) => ({ ...d, [questionId]: "" }));
  };

  const openCount = questions.filter((q) => q.status === "open").length;
  const sorted = sortQueue(questions);

  return (
    <div className="engagement-panel">
      {showClarityTab ? (
        <div className="engagement-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preguntas"}
            onClick={() => setTab("preguntas")}
          >
            Cola {openCount > 0 && <span className="badge">{openCount}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "claridad"}
            onClick={() => setTab("claridad")}
          >
            Claridad
          </button>
        </div>
      ) : (
        <h4 className="analytics-subhead">Preguntas de la reunión</h4>
      )}
      {error && <p className="pill pill--warn">{error}</p>}
      {tab === "preguntas" && (
        <ul className="engagement-list">
          {sorted.length === 0 && (
            <li className="muted">Todavía no hay solicitudes en la cola.</li>
          )}
          {sorted.map((q) => {
            const kind = (q.request_kind ?? "written_question") as MeetingQueueRequestKind;
            const oral = kind === "oral_turn";
            return (
              <li
                key={q.id}
                className={`${q.status !== "open" ? "answered" : ""} ${oral ? "oral-turn" : ""}`}
              >
                <div className="meta">
                  <strong>{KIND_LABEL[kind]}</strong>
                  {" · "}
                  {q.section_label}
                  {q.presentation_point_id ? ` · ${q.presentation_point_id}` : ""} ·{" "}
                  {new Date(q.created_at).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · sesión …{q.participant_id.slice(-6)} · {q.source}
                </div>
                <p>
                  {oral
                    ? "El participante solicita intervenir oralmente en la reunión externa. No envió pregunta escrita."
                    : (q.text ?? "—")}
                </p>
                {q.answer_text && <div className="engagement-answer">{q.answer_text}</div>}
                {q.status === "open" && (
                  <div className="engagement-reply">
                    <div className="engagement-inline-actions">
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => void patchItem(q.id, { status: "answered" })}
                      >
                        Marcar atendida
                      </button>
                      <button
                        type="button"
                        className="btn-small ghost"
                        onClick={() => void patchItem(q.id, { status: "dismissed" })}
                      >
                        Descartar
                      </button>
                    </div>
                    {(kind === "written_question" ||
                      kind === "assistant_to_presenter" ||
                      kind === "ai_escalation") && (
                      <>
                        <textarea
                          rows={2}
                          placeholder="Respuesta privada para este participante"
                          value={answerDraft[q.id] ?? ""}
                          onChange={(e) =>
                            setAnswerDraft((d) => ({ ...d, [q.id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => void publishAnswer(q.id)}
                        >
                          Responder en privado
                        </button>
                      </>
                    )}
                  </div>
                )}
                {q.status === "dismissed" && (
                  <div className="muted">Descartada</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {showClarityTab && tab === "claridad" && (
        <ul className="engagement-list">
          {CHAPTERS.map((ch) => {
            const c =
              clarity[ch.chartFocus] ??
              clarity[`sec-${ch.chartFocus}`] ??
              clarity[`chapter-${ch.n}`];
            return (
              <li key={ch.n}>
                <strong>{ch.t}</strong>
                {!c ? (
                  <div className="muted">Aún no hay votos.</div>
                ) : (
                  <div className="clarity-bars">
                    <span>Claro: {c.claro}</span>
                    <span>Dudas: {c.duda}</span>
                    <span>Explorar: {c.explorar ?? 0}</span>
                    <span>Glosario: {c.glosario}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
