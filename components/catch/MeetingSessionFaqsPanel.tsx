"use client";

import { prepFaqsForDisplay, type PrepFaqItem } from "@/lib/meeting/prep-faqs";

type Props = {
  items: PrepFaqItem[];
  variant?: "rail" | "modal";
};

export function MeetingSessionFaqsPanel({ items, variant = "rail" }: Props) {
  const visible = prepFaqsForDisplay(items);

  if (visible.length === 0) {
    return (
      <div className="session-faqs session-faqs--empty">
        <p>No hay preguntas frecuentes configuradas para esta reunión.</p>
        <p className="muted">El presentador puede añadirlas durante la preparación.</p>
      </div>
    );
  }

  return (
    <section
      className={`session-faqs${variant === "modal" ? " session-faqs--modal" : ""}`}
      aria-label="Preguntas frecuentes"
    >
      <ul className="session-faqs__list">
        {visible.map((item, index) => (
          <li key={item.id} className="session-faqs__item">
            <p className="session-faqs__q">
              <span className="session-faqs__n">{index + 1}.</span> {item.question.trim()}
            </p>
            {item.answer.trim() ? (
              <p className="session-faqs__a">{item.answer.trim()}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
