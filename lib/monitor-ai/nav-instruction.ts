/** Intenciones de navegación explícitas del moderador (equivalentes a Anterior/Siguiente). */

export type ModeratorNavInstruction = "next_slide" | "previous_slide";

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detecta «avanza / siguiente punto» y «regresa / punto anterior».
 * No intercepta saltos a sección ni explicaciones.
 */
export function resolveModeratorNavInstruction(
  instruction: string,
): ModeratorNavInstruction | null {
  const f = fold(instruction);
  if (!f) return null;
  if (/\bseccion\b/.test(f) && !/\bsiguiente punto\b/.test(f) && !/\bpunto anterior\b/.test(f)) {
    return null;
  }
  if (/\b(explica|resalta|pausa|reanuda|repite)\b/.test(f)) return null;

  const prev =
    /\b(regresa|regresar|retrocede|retroceder|anterior|atras|vuelve|volver)\b/.test(f) &&
    (/\b(punto|paso|slide|diapositiva)\b/.test(f) ||
      /^(regresa|regresar|retrocede|anterior|atras|vuelve)$/.test(f) ||
      /^(regresa|vuelve|retrocede) al (punto|paso) anterior$/.test(f) ||
      /^al punto anterior$/.test(f) ||
      /^punto anterior$/.test(f));
  if (prev) return "previous_slide";

  const next =
    /\b(avanza|avanzar|adelante|siguiente)\b/.test(f) &&
    !/\bseccion\b/.test(f);
  if (next) return "next_slide";

  if (/^contin(ua|uar) con el siguiente( punto| paso)$/.test(f)) {
    return "next_slide";
  }

  return null;
}
