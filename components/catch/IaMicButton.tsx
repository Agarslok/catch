"use client";

type Props = {
  listening: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** compact = dock del avatar; chat = fila de pregunta */
  variant?: "chat" | "dock";
};

const MIC_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 1.75a3.25 3.25 0 0 0-3.25 3.25V12a3.25 3.25 0 0 0 6.5 0V5a3.25 3.25 0 0 0-3.25-3.25z" />
    <path d="M5 11.5a7 7 0 0 0 14 0" />
    <path d="M12 18.5V22" />
    <path d="M9 22h6" />
  </svg>
);

export function IaMicButton({ listening, disabled, onClick, variant = "chat" }: Props) {
  return (
    <button
      type="button"
      className={`ia-mic-btn ia-mic-btn--${variant}${listening ? " escuchando" : ""}`}
      disabled={disabled}
      onClick={onClick}
      title={listening ? "Detener dictado" : "Dictar pregunta"}
      aria-label={listening ? "Detener dictado por voz" : "Dictar pregunta por voz"}
      aria-pressed={listening}
    >
      <span className="ia-mic-ondas" aria-hidden="true" />
      <span className="ia-mic-ico">{MIC_SVG}</span>
      <span className="ia-mic-barras" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
