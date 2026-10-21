"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { IaMicButton } from "@/components/catch/IaMicButton";

export type AsyncChatLine = { role: "user" | "assistant"; text: string };

type Props = {
  variant?: "rail" | "inline";
  avatarSlot?: ReactNode;
  thread: AsyncChatLine[];
  question: string;
  asking: boolean;
  askStatus: string;
  onQuestionChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  voiceSupported: boolean;
  voiceListening: boolean;
  onVoiceToggle: () => void;
};

function AsyncIaChatFields({
  variant,
  threadRef,
  thread,
  question,
  asking,
  askStatus,
  onQuestionChange,
  onSubmit,
  voiceSupported,
  voiceListening,
  onVoiceToggle,
}: Props & { threadRef: React.RefObject<HTMLDivElement | null> }) {
  const isRail = variant === "rail";

  return (
    <>
      {isRail ? null : (
        <div className="ask-head">
          <h2 className="headline ask-chat-title">Chatear con la IA</h2>
          <p className="ask-chart-hint">
            Toque una barra o columna para «Preguntar a la IA», o seleccione texto en la
            diapositiva.
          </p>
        </div>
      )}
      <div
        ref={threadRef}
        className={
          isRail
            ? "async-ai-rail__thread ask-thread ask-thread--async-rail"
            : "ask-thread"
        }
        aria-live="polite"
        aria-label="Historial del chat"
      >
        {thread.length === 0 ? (
          isRail ? (
            <p className="async-ai-rail__thread-empty">
              Pregunte sobre la diapositiva. Toque un dato del gráfico o seleccione texto en el
              centro.
            </p>
          ) : null
        ) : (
          thread.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={m.role === "user" ? "ask-thread__user" : "ask-thread__ai"}
            >
              {m.text}
            </div>
          ))
        )}
      </div>
      {isRail ? (
        <p className="async-ai-rail__hint ask-chart-hint">
          Para el equipo humano use «Preguntar al equipo Catch» arriba.
        </p>
      ) : null}
      <div className="ask-row">
        <input
          id="q"
          className="ask-input--dark"
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={
            isRail ? "Escriba su pregunta…" : "¿Qué significa rotación no controlada?"
          }
          aria-label="Chatear con la IA"
          autoComplete="off"
          disabled={asking}
        />
        {voiceSupported ? (
          <IaMicButton
            variant="chat"
            listening={voiceListening}
            disabled={asking}
            onClick={onVoiceToggle}
          />
        ) : null}
        <button type="submit" className="send" disabled={asking}>
          {asking ? "…" : "Enviar"}
        </button>
      </div>
      <span className="ask-ok">{askStatus}</span>
    </>
  );
}

export function AsyncIaSideRail({
  variant = "rail",
  avatarSlot,
  thread,
  question,
  asking,
  askStatus,
  onQuestionChange,
  onSubmit,
  voiceSupported,
  voiceListening,
  onVoiceToggle,
}: Props) {
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread, asking]);

  const fields = (
    <AsyncIaChatFields
      variant={variant}
      threadRef={threadRef}
      thread={thread}
      question={question}
      asking={asking}
      askStatus={askStatus}
      onQuestionChange={onQuestionChange}
      onSubmit={onSubmit}
      voiceSupported={voiceSupported}
      voiceListening={voiceListening}
      onVoiceToggle={onVoiceToggle}
    />
  );

  if (variant === "inline") {
    return (
      <form
        className="ask ask--async-inline"
        onSubmit={(e) => void onSubmit(e)}
        id="session-chat"
      >
        {fields}
      </form>
    );
  }

  return (
    <aside className="async-ai-rail" aria-label="Avatar y chat con la IA">
      <div className="async-ai-rail__head">
        <span className="async-ai-rail__title">Asistente IA</span>
      </div>
      {avatarSlot ? <div className="async-ai-rail__avatar">{avatarSlot}</div> : null}
      <form
        className="async-ai-rail__chat ask ask--async-rail"
        onSubmit={(e) => void onSubmit(e)}
        id="session-chat"
      >
        {fields}
      </form>
    </aside>
  );
}
