"use client";

import { useState } from "react";
import { GLOSSARY, glossaryTermsForChapter } from "@/lib/data/glossary";
import type { ClarityVote } from "@/lib/meeting/session-types";

type Props = {
  meetingId: string;
  participantId: string;
  sectionKey: string;
  sectionLabel: string;
  chartFocus: string;
  participantToken?: string;
  showClarityButton?: boolean;
  onAskPrivate?: () => void;
  onReviewConcepts?: () => void;
  onClarityVote?: (vote: ClarityVote) => void;
};

export function MeetingVisitorTools({
  sectionLabel,
  chartFocus,
  showClarityButton = false,
  onAskPrivate,
  onReviewConcepts,
}: Props) {
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const terms = glossaryTermsForChapter(chartFocus);

  return (
    <>
      <div className="visitor-tools">
        <button type="button" className="btn-small" onClick={() => setGlossaryOpen(true)}>
          Glosario
        </button>
        <button type="button" className="btn-small" onClick={() => onAskPrivate?.()}>
          Tengo dudas
        </button>
        <button type="button" className="btn-small" onClick={() => onReviewConcepts?.()}>
          Quiero repasar conceptos
        </button>
        {showClarityButton && (
          <button type="button" className="btn-small" onClick={() => onReviewConcepts?.()}>
            ¿Quedó claro?
          </button>
        )}
      </div>

      {glossaryOpen && (
        <div className="catch-modal-veil" role="presentation" onClick={() => setGlossaryOpen(false)}>
          <div
            className="catch-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Glosario"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Glosario · {sectionLabel}</h3>
            <dl className="catch-glossary">
              {terms.map((term) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{GLOSSARY[term] ?? ""}</dd>
                </div>
              ))}
            </dl>
            <div className="catch-modal-actions">
              <button type="button" className="solid solid--on-light" onClick={() => setGlossaryOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
