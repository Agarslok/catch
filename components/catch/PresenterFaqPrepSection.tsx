"use client";

import { useCallback } from "react";
import {
  addPrepFaq,
  newPrepFaqId,
  removePrepFaq,
  updatePrepFaq,
  type PrepFaqItem,
} from "@/lib/meeting/prep-faqs";

export type PresenterPrepFaqItem = PrepFaqItem;

export function newPresenterPrepFaqId() {
  return newPrepFaqId();
}

type Props = {
  items: PresenterPrepFaqItem[];
  onChange: (items: PresenterPrepFaqItem[]) => void;
  variant?: "main" | "rail";
};

export function PresenterFaqPrepSection({ items, onChange, variant = "main" }: Props) {
  const addItem = useCallback(() => {
    onChange(addPrepFaq(items));
  }, [items, onChange]);

  const updateItem = useCallback(
    (id: string, patch: Partial<Pick<PresenterPrepFaqItem, "question" | "answer">>) => {
      onChange(updatePrepFaq(items, id, patch));
    },
    [items, onChange],
  );

  const removeItem = useCallback(
    (id: string) => {
      onChange(removePrepFaq(items, id));
    },
    [items, onChange],
  );

  const rail = variant === "rail";

  return (
    <section
      className={`presenter-faq-prep${rail ? " presenter-faq-prep--rail" : ""}`}
      aria-labelledby="presenter-faq-prep-title"
    >
      <header className="presenter-faq-prep__head">
        {!rail ? <h2 id="presenter-faq-prep-title">Preguntas frecuentes</h2> : null}
        <p className="presenter-faq-prep__lead">
          Prepara preguntas y respuestas para facilitar la resolución de dudas durante la reunión.
        </p>
        <ul className="presenter-faq-prep__tips">
          <li>Use lenguaje claro y respuestas breves que pueda leer en voz alta.</li>
          <li>Puede añadir tantas entradas como necesite antes de iniciar.</li>
          <li>Se guarda para esta reunión y permanece al iniciar la sesión o recargar.</li>
        </ul>
      </header>

      {items.length === 0 ? (
        <div className="presenter-faq-prep__empty">
          <p>Aún no hay preguntas frecuentes.</p>
          <p className="muted">Pulse el botón inferior para crear la primera.</p>
        </div>
      ) : (
        <ul className="presenter-faq-prep__list">
          {items.map((item, index) => (
            <li key={item.id} className="presenter-faq-prep__item">
              <div className="presenter-faq-prep__item-head">
                <span className="presenter-faq-prep__item-label">Pregunta {index + 1}</span>
                <button
                  type="button"
                  className="btn-small presenter-faq-prep__remove"
                  onClick={() => removeItem(item.id)}
                >
                  Eliminar
                </button>
              </div>
              <label className="presenter-faq-prep__field">
                <span>Pregunta</span>
                <input
                  type="text"
                  value={item.question}
                  placeholder="Ej. ¿Cómo se calcula la rotación del bimestre?"
                  onChange={(e) => updateItem(item.id, { question: e.target.value })}
                />
              </label>
              <label className="presenter-faq-prep__field">
                <span>Respuesta</span>
                <textarea
                  rows={rail ? 2 : 3}
                  value={item.answer}
                  placeholder="Redacte la respuesta que dará si surge esta duda en la reunión."
                  onChange={(e) => updateItem(item.id, { answer: e.target.value })}
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="solid presenter-faq-prep__add" onClick={addItem}>
        + Añadir pregunta frecuente
      </button>
    </section>
  );
}
