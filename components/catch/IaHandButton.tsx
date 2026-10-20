"use client";

type Props = {
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
};

const HAND_SVG = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 11V6.2a1.2 1.2 0 1 1 2.4 0V11" />
    <path d="M9.4 11V5.4a1.2 1.2 0 1 1 2.4 0V11" />
    <path d="M11.8 11V6a1.2 1.2 0 1 1 2.4 0v7.2c0 2.6 1.6 4.9 4 5.8" />
    <path d="M7 11v1.2c0 2.2 1.2 4.2 3.1 5.2" />
    <path d="M5.5 12.5 4 14" />
  </svg>
);

export function IaHandButton({ disabled, active = false, onClick }: Props) {
  return (
    <button
      type="button"
      className={`ia-hand-btn${active ? " activo" : ""}`}
      disabled={disabled}
      onClick={onClick}
      title="Levantar la mano: cortar a Frida y pedir turno"
      aria-label="Levantar la mano para hacer una pregunta"
      aria-pressed={active}
    >
      <span className="ia-hand-ico">{HAND_SVG}</span>
    </button>
  );
}
