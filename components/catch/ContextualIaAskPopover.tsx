"use client";

type Props = {
  x: number;
  y: number;
  onAsk: () => void;
  onDismiss: () => void;
};

export function ContextualIaAskPopover({ x, y, onAsk, onDismiss }: Props) {
  return (
    <>
      <button
        type="button"
        className="contextual-ia-veil"
        aria-label="Cerrar menú de pregunta"
        onClick={onDismiss}
      />
      <div
        className="popover-seleccion-ia"
        style={{ left: x, top: y }}
        role="dialog"
        aria-label="Preguntar a la IA sobre la selección"
      >
        <button type="button" className="solid solid--on-light" onClick={onAsk}>
          Preguntar a la IA
        </button>
      </div>
    </>
  );
}
