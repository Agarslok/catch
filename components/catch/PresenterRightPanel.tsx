"use client";

import { useState } from "react";
import { MeetingAnalyticsPanel } from "@/components/catch/MeetingAnalyticsPanel";
import { PresenterVisitorRoster } from "@/components/catch/PresenterVisitorRoster";
import { PresenterEngagementPanel } from "@/components/catch/PresenterEngagementPanel";
import { MeetingSessionFaqsPanel } from "@/components/catch/MeetingSessionFaqsPanel";
import {
  PresenterFaqPrepSection,
  type PresenterPrepFaqItem,
} from "@/components/catch/PresenterFaqPrepSection";
import { VisualTemplateExpandedDetails } from "@/components/catch/VisualTemplateExpandedDetails";
import type { ActivityRow } from "@/lib/activity/types";
import type { MonitorSessionPhase } from "@/lib/meeting/monitor-session-phase";
import { visitorSeesMeeting } from "@/lib/meeting/monitor-session-phase";
import { meetingParticipationHistoryVisible } from "@/lib/meeting/participant-roster-view";
import { presenterRailPanel } from "@/lib/meeting/presenter-session-ui";
import {
  PRESENTER_VISUAL_TEMPLATES,
  type PresenterVisualTemplateId,
} from "@/lib/meeting/presenter-visual-templates";

export type PresenterLiveRailTab = "participantes" | "preguntas" | "intereses";

type Props = {
  meetingId: string;
  presenterToken?: string;
  sessionPhase: MonitorSessionPhase;
  activity: ActivityRow[];
  activeTab: PresenterLiveRailTab;
  onTabChange: (tab: PresenterLiveRailTab) => void;
  prepFaqs: PresenterPrepFaqItem[];
  onPrepFaqsChange: (items: PresenterPrepFaqItem[]) => void;
  visualTemplate: PresenterVisualTemplateId;
  onVisualTemplateChange: (id: PresenterVisualTemplateId) => void;
  atClosingStep?: boolean;
};

export function PresenterRightPanel({
  meetingId,
  presenterToken,
  sessionPhase,
  activity,
  activeTab: tab,
  onTabChange: setTab,
  prepFaqs,
  onPrepFaqsChange,
  visualTemplate,
  onVisualTemplateChange,
  atClosingStep = false,
}: Props) {
  const meetingLive = visitorSeesMeeting(sessionPhase);
  const showParticipationHistory = meetingParticipationHistoryVisible(
    sessionPhase,
    atClosingStep,
  );
  const activityCount = activity.length;
  const mode = presenterRailPanel(sessionPhase);
  const selectedMeta = PRESENTER_VISUAL_TEMPLATES.find((t) => t.id === visualTemplate);
  const [expandedTemplate, setExpandedTemplate] =
    useState<PresenterVisualTemplateId | null>(null);

  const onTemplateCardClick = (id: PresenterVisualTemplateId) => {
    onVisualTemplateChange(id);
    setExpandedTemplate((prev) => (prev === id ? null : id));
  };

  const title =
    mode === "templates"
      ? "Plantillas"
      : mode === "faqs"
        ? "Preguntas frecuentes"
        : "Panel del presentador";

  return (
    <aside className="presenter-side-rail" aria-label="Panel del presentador">
      {mode === "live" ? (
        <div className="presenter-side-tabs" role="tablist" aria-label="Secciones del panel">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "participantes"}
            onClick={() => setTab("participantes")}
          >
            Participantes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preguntas"}
            onClick={() => setTab("preguntas")}
          >
            Preguntas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "intereses"}
            onClick={() => setTab("intereses")}
          >
            Intereses
            {activityCount > 0 && <span className="badge">{activityCount}</span>}
          </button>
        </div>
      ) : (
        <div className="presenter-side-tabs presenter-side-tabs--solo">
          <span
            className="presenter-side-tabs__title"
            id={mode === "faqs" ? "presenter-faq-prep-title" : undefined}
          >
            {title}
          </span>
        </div>
      )}

      <div className="presenter-side-body">
        {mode === "templates" && (
          <div className="visual-template-panel" role="tabpanel">
            <p className="visual-template-panel__lead">
              Elija la plantilla del informe. Pulse una tarjeta para ver utilidad, guión y colores.
              MML viene seleccionada por defecto.
            </p>
            <div className="visual-template-stack">
              {PRESENTER_VISUAL_TEMPLATES.map((tpl) => {
                const selected = visualTemplate === tpl.id;
                const expanded = expandedTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`visual-template-card${selected ? " visual-template-card--selected" : ""}${expanded ? " visual-template-card--expanded" : ""}`}
                    aria-pressed={selected}
                    aria-expanded={expanded}
                    onClick={() => onTemplateCardClick(tpl.id)}
                  >
                    <div className="visual-template-card__head">
                      <span className="visual-template-card__name">{tpl.label}</span>
                      {tpl.id === "mml" ? (
                        <span className="visual-template-card__default">Predeterminada</span>
                      ) : null}
                      {selected ? (
                        <span className="visual-template-card__picked">Seleccionada</span>
                      ) : null}
                    </div>
                    <p className="visual-template-card__specialty visual-template-card__specialty--lead">
                      {tpl.specialty}
                    </p>
                    <p className="visual-template-card__desc">{tpl.description}</p>
                    <div
                      className={`visual-template-card__details-shell${expanded ? " is-open" : ""}`}
                    >
                      <div className="visual-template-card__details-inner">
                        {expanded ? (
                          <VisualTemplateExpandedDetails tpl={tpl} active={expanded} />
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedMeta ? (
              <p className="visual-template-panel__status">
                Plantilla activa: <strong>{selectedMeta.label}</strong>
              </p>
            ) : null}
          </div>
        )}

        {mode === "faqs" && (
          <PresenterFaqPrepSection
            variant="rail"
            items={prepFaqs}
            onChange={onPrepFaqsChange}
          />
        )}

        {mode === "live" && meetingLive && tab === "participantes" && (
          <div role="tabpanel">
            {presenterToken ? (
              <PresenterVisitorRoster
                meetingId={meetingId}
                presenterToken={presenterToken}
                active={true}
                showParticipationHistory={showParticipationHistory}
              />
            ) : (
              <p className="muted">Sin token de presentador.</p>
            )}
          </div>
        )}

        {mode === "live" && meetingLive && tab === "preguntas" && (
          <div role="tabpanel">
            {presenterToken ? (
              <>
                <h4 className="analytics-subhead">Preguntas frecuentes</h4>
                <MeetingSessionFaqsPanel items={prepFaqs} variant="rail" />
                <PresenterEngagementPanel
                  meetingId={meetingId}
                  presenterToken={presenterToken}
                  active={true}
                  showClarityTab={false}
                />
              </>
            ) : (
              <p className="muted">Sin token de presentador.</p>
            )}
          </div>
        )}

        {mode === "live" && meetingLive && tab === "intereses" && (
          <div role="tabpanel">
            {presenterToken ? (
              <>
                <MeetingAnalyticsPanel
                  meetingId={meetingId}
                  active={true}
                  presenterToken={presenterToken}
                />
                <h4 className="analytics-subhead">Eventos en vivo</h4>
                <ul className="activity-feed">
                  {activity.length === 0 && (
                    <li className="muted">Sin eventos aún. Conecta visitantes con Supabase.</li>
                  )}
                  {activity.map((row) => (
                    <li key={row.id}>
                      <strong>{row.event_type}</strong> · {row.actor_name ?? "—"}{" "}
                      <span className="muted">
                        {new Date(row.created_at).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Sin token de presentador.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
