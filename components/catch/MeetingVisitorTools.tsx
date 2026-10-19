"use client";

import { useEffect, useState } from "react";
import { MeetingSessionFaqsPanel } from "@/components/catch/MeetingSessionFaqsPanel";
import { normalizePrepFaqs, type PrepFaqItem } from "@/lib/meeting/prep-faqs";
import type { ClarityVote } from "@/lib/meeting/session-types";

type Props = {
  meetingId: string;
  participantId: string;
  sectionKey: string;
  sectionLabel: string;
  chartFocus: string;
  participantToken?: string;
  prepFaqs: PrepFaqItem[];
  showClarityButton?: boolean;
  onAskPrivate?: () => void;
  onReviewConcepts?: () => void;
  onClarityVote?: (vote: ClarityVote) => void;
};

export function MeetingVisitorTools({
  meetingId,
  prepFaqs,
  showClarityButton = false,
  onAskPrivate,
  onReviewConcepts,
}: Props) {
  const [faqsOpen, setFaqsOpen] = useState(false);
  const [remoteFaqs, setRemoteFaqs] = useState<PrepFaqItem[]>(prepFaqs);

  useEffect(() => {
    setRemoteFaqs(prepFaqs);
  }, [prepFaqs]);

  useEffect(() => {
    if (!faqsOpen || !meetingId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/meeting/${meetingId}/prep-faqs`);
        if (!res.ok) return;
        const data = (await res.json()) as { items?: unknown };
        if (!cancelled) setRemoteFaqs(normalizePrepFaqs(data.items));
      } catch {
        /* keep last known list */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [faqsOpen, meetingId]);

  return (
    <>
      <div className="visitor-tools">
        <button type="button" className="btn-small" onClick={() => setFaqsOpen(true)}>
          Preguntas frecuentes
        </button>
        <button type="button" className="btn-small" onClick={() => onAskPrivate?.()}>
          Preguntar al presentador
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

      {faqsOpen && (
        <div className="catch-modal-veil" role="presentation" onClick={() => setFaqsOpen(false)}>
          <div
            className="catch-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Preguntas frecuentes"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Preguntas frecuentes</h3>
            <MeetingSessionFaqsPanel items={remoteFaqs} variant="modal" />
            <div className="catch-modal-actions">
              <button type="button" className="solid solid--on-light" onClick={() => setFaqsOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
