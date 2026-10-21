"use client";

type Props = {
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** +40px sobre el borde inferior (marca web / UI inferior en móvil o async). */
  elevated?: boolean;
};

export function PresentationFloatingNav({
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  elevated = false,
}: Props) {
  return (
    <div
      className={`nav-flotante-dock${elevated ? " nav-flotante-dock--elevated" : ""}`}
      role="group"
      aria-label="Navegación de diapositivas"
    >
      <button
        type="button"
        className="nav-flotante-btn"
        onClick={onPrev}
        disabled={prevDisabled}
        aria-label="Paso anterior"
        title="Anterior (flecha izquierda)"
      >
        ‹
      </button>
      <button
        type="button"
        className="nav-flotante-btn"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label="Paso siguiente"
        title="Siguiente (flecha derecha)"
      >
        ›
      </button>
    </div>
  );
}
