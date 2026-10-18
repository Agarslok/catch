"use client";

import { GLOSSARY, glossaryTermsForChapter } from "@/lib/data/glossary";
import { CHAPTERS } from "@/lib/data/guanajuato-2026";
import {
  chapterMeta,
  sectionForPoint,
  sheetIndexItems,
  type SheetIndexItem,
} from "@/lib/meeting/script";
import type { ScriptPoint, SessionScript } from "@/lib/meeting/script-types";
import type { ClarityVote } from "@/lib/meeting/session-types";

export function IntroductionView({ script }: { script: SessionScript }) {
  return (
    <section className="stage stage--copy">
      <div className="text">
        <p className="chapter">Monitor de Mercado Laboral</p>
        <h1 className="headline">Cómo está el mercado en esta edición</h1>
        <p className="sub">
          En cada capítulo se explican las gráficas una a una, luego se abre la hoja completa y,
          antes de seguir, se confirma si quedó claro.
        </p>
      </div>
      <div className="agenda-grid">
        {script.sections.map((sec) => (
          <div key={sec.id}>
            <b>{sec.name}</b>
            <span>{sec.summary}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FullSheetView({
  point,
  script,
  unlockedIndex,
  isPresenter,
  onOpenItem,
}: {
  point: ScriptPoint;
  script: SessionScript;
  unlockedIndex: number;
  isPresenter: boolean;
  onOpenItem: (item: SheetIndexItem) => void;
}) {
  const section = sectionForPoint(script, point);
  const items = section ? sheetIndexItems(script, section.id) : [];

  return (
    <section className="stage stage--index">
      <div className="sheet-head">
        <p className="chapter">{section?.name} · Hoja completa</p>
        <h1 className="headline headline--sheet">Índice de la sección</h1>
        <p className="sub sub--sheet">
          Elija una gráfica o tabla para abrirla en su punto original. Esta vista no adelanta la
          presentación.
        </p>
      </div>
      <div className="sheet-tabs" role="tablist" aria-label="Contenido de la sección">
        {items.map((item) => {
          const origin = script.points.find((p) => p.id === item.pointId);
          const originIndex = origin ? origin.order : 0;
          const locked = !isPresenter && originIndex > unlockedIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              className="sheet-tab"
              disabled={locked}
              onClick={() => {
                if (!locked) onOpenItem(item);
              }}
            >
              <span className="sheet-tab-type">
                {item.type === "table" ? "Tabla" : "Gráfica"}
              </span>
              <strong>{item.title}</strong>
              <span className="sheet-tab-sub">{item.subtitle}</span>
              <span className="sheet-tab-go">
                {locked ? "Aún no presentado" : "Abrir en su contexto"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ClarityStepView({
  sectionLabel,
  chapterIndex,
  voted,
  onClear,
  onDoubts,
  onReview,
  onExplore,
}: {
  sectionLabel: string;
  chapterIndex: number;
  voted: ClarityVote | null;
  onClear: () => void;
  onDoubts: () => void;
  onReview: () => void;
  onExplore?: () => void;
}) {
  const ch = CHAPTERS[chapterIndex] ?? CHAPTERS[0];
  return (
    <section className="stage stage--copy">
      <div className="clarity-block">
        <p className="chapter">Antes de continuar · {sectionLabel}</p>
        <h1 className="headline headline--sheet">¿Quedó claro lo que vimos?</h1>
        <ul className="clarity-findings">
          <li>
            <b>Hallazgo</b>
            <span>{ch.headline}</span>
          </li>
          <li>
            <b>Indicador</b>
            <span>
              {ch.big} · {ch.s1v} {ch.s1l} · {ch.s2v} {ch.s2l}
            </span>
          </li>
          <li>
            <b>Periodo e interpretación</b>
            <span>{ch.sub}</span>
          </li>
        </ul>
        <div className="clarity-actions">
          <button type="button" className="clarity-btn clarity-btn--ok" onClick={onClear}>
            Sí, quedó claro
            <small>Se registra su respuesta. El presentador decide cuándo avanzar.</small>
          </button>
          <button type="button" className="clarity-btn clarity-btn--ask" onClick={onDoubts}>
            Tengo dudas
            <small>Escriba una pregunta privada. Solo usted y el moderador la ven.</small>
          </button>
          <button type="button" className="clarity-btn clarity-btn--review" onClick={onReview}>
            Quiero repasar conceptos
            <small>Consulta local de esta sección, sin cambiar lo que ve el resto.</small>
          </button>
          {onExplore && (
            <button type="button" className="clarity-btn" onClick={onExplore}>
              Quiero explorar
              <small>Revisa la sección a su ritmo. El presentador ve que eligió explorar.</small>
            </button>
          )}
        </div>
        {voted && (
          <p className="ask-ok">
            Respuesta registrada
            {voted === "claro"
              ? ": quedó claro."
              : voted === "duda"
                ? ": tiene dudas."
                : voted === "explorar"
                  ? ": explorará la sección."
                  : ": repasará conceptos."}
          </p>
        )}
      </div>
    </section>
  );
}

export function ConceptReviewView({
  sectionLabel,
  chapterIndex,
  onClose,
}: {
  sectionLabel: string;
  chapterIndex: number;
  onClose: () => void;
}) {
  const ch = chapterMeta(chapterIndex) ?? CHAPTERS[0];
  const terms = glossaryTermsForChapter(ch.chartFocus);
  return (
    <section className="stage stage--copy">
      <div className="review-block">
        <div className="sheet-head">
          <p className="chapter">Repaso conceptual · {sectionLabel}</p>
          <h1 className="headline headline--sheet">{ch.headline}</h1>
          <p className="sub sub--sheet">{ch.sub}</p>
        </div>
        <div className="review-kpis">
          <div>
            <b>{ch.big}</b>
            <span>Indicador principal</span>
          </div>
          <div>
            <b>{ch.s1v}</b>
            <span>{ch.s1l}</span>
          </div>
          <div>
            <b>{ch.s2v}</b>
            <span>{ch.s2l}</span>
          </div>
        </div>
        <p className="review-cap">{ch.capA}</p>
        <p className="review-cap">{ch.capB}</p>
        <dl className="catch-glossary">
          {terms.map((term) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{GLOSSARY[term] ?? ""}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="solid solid--on-light" onClick={onClose}>
          Volver
        </button>
      </div>
    </section>
  );
}

export function VisitorWaitingView() {
  return (
    <section className="stage stage--copy">
      <div className="text" style={{ textAlign: "center", margin: "0 auto" }}>
        <p className="chapter">Catch</p>
        <h1 className="headline">Bienvenido a Catch</h1>
        <p className="sub">Esperando el inicio de la reunión</p>
        <p className="sub">
          El presentador está preparando la sesión. Esta pantalla cambiará
          automáticamente cuando la reunión comience.
        </p>
      </div>
    </section>
  );
}

export function PresenterPreparationView({
  fileName,
  busy,
  onFile,
  onNext,
}: {
  fileName: string;
  busy: boolean;
  onFile: (name: string) => void;
  onNext: () => void;
}) {
  return (
    <section className="stage stage--copy">
      <div className="text">
        <p className="chapter">Preparación</p>
        <h1 className="headline">Bienvenido a Catch</h1>
        <p className="sub">
          Prepara la información para iniciar tu reunión. Puedes continuar sin
          subir archivos; se usará el informe de demostración.
        </p>
        <label className="clarity-btn clarity-btn--review" style={{ display: "block", cursor: "pointer" }}>
          <input
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f.name);
            }}
          />
          Subir base de datos o información
          <small>Opcional · no se analiza en esta versión</small>
        </label>
        {fileName ? <p className="sub">Archivo: {fileName}</p> : null}
        <button type="button" className="solid" disabled={busy} onClick={onNext}>
          Siguiente
        </button>
      </div>
    </section>
  );
}

export function PresenterGeneratingView({ message }: { message: string }) {
  return (
    <section className="stage stage--copy">
      <div className="text" style={{ textAlign: "center" }}>
        <p className="chapter">Preparación</p>
        <h1 className="headline">Generando informe…</h1>
        <p className="sub">{message}</p>
      </div>
    </section>
  );
}

export function ClosingView({
  script,
  isPresenter,
  onDownloadCatch,
  onDownloadClient,
}: {
  script: SessionScript;
  isPresenter: boolean;
  onDownloadCatch?: () => void;
  onDownloadClient: () => void;
}) {
  return (
    <section className="stage stage--copy">
      <div className="text">
        <p className="chapter">Cierre</p>
        <h1 className="headline">Gracias. Así quedó la sesión</h1>
        <p className="sub">
          {isPresenter
            ? "Descargue el feedback interno de Catch o el informe para entregar al cliente."
            : "Descargue el resumen de la sesión preparado para usted."}
        </p>
      </div>
      <div className="agenda-grid">
        {script.sections.map((sec) => (
          <div key={sec.id}>
            <b>{sec.name}</b>
            <span>{sec.summary}</span>
          </div>
        ))}
      </div>
      <div className="clarity-actions" style={{ marginTop: "1.25rem" }}>
        {isPresenter && onDownloadCatch ? (
          <button
            type="button"
            className="clarity-btn clarity-btn--ask"
            onClick={onDownloadCatch}
          >
            Descargar PDF de feedback de Catch
            <small>Uso interno Catch · contenido de demostración</small>
          </button>
        ) : null}
        <button
          type="button"
          className="clarity-btn clarity-btn--ok"
          onClick={onDownloadClient}
        >
          Descargar PDF para el cliente
          <small>Resumen profesional para compartir con el cliente</small>
        </button>
      </div>
    </section>
  );
}
