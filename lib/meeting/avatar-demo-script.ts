import { CHAPTERS } from "@/lib/data/guanajuato-2026";
import type { SessionScript } from "@/lib/meeting/script-types";

export type AvatarScriptBlock =
  | {
      kind: "opening";
      title: string;
      moment: string;
      visualization: string;
      script: string;
    }
  | {
      kind: "section";
      sectionNumber: number;
      title: string;
      moment: string;
      visualization: string;
      script: string;
    }
  | {
      kind: "sheet";
      title: string;
      moment: string;
      visualization: string;
      script: string;
    }
  | { kind: "pause"; moment: string; script: string }
  | { kind: "transition"; script: string }
  | {
      kind: "closing";
      moment: string;
      visualization: string;
      script: string;
    };

export function buildAvatarDemoScript(script: SessionScript): AvatarScriptBlock[] {
  const blocks: AvatarScriptBlock[] = [];

  blocks.push({
    kind: "opening",
    title: "Inicio",
    moment: "Al iniciar la reunión, paso de bienvenida y agenda.",
    visualization: "Portada con los capítulos del monitor de demostración.",
    script:
      "Bienvenidos. En esta sesión revisaremos, con datos de demostración del Monitor de Mercado Laboral, cómo se compara su empresa con el mercado de referencia, capítulo por capítulo.",
  });

  script.sections.forEach((sec, i) => {
    const ch = CHAPTERS[i] ?? CHAPTERS.find((c) => c.t === sec.name);
    const n = i + 1;

    blocks.push({
      kind: "section",
      sectionNumber: n,
      title: sec.name,
      moment: `Capítulo ${n} · primera gráfica de «${sec.name}».`,
      visualization: ch ? `${ch.eyebrow} — ${ch.capA}` : `Primera visualización de ${sec.name}.`,
      script: ch
        ? `Comencemos con ${sec.name}. ${ch.sub}`
        : `Comencemos con ${sec.name}. ${sec.summary || ""}`.trim(),
    });

    blocks.push({
      kind: "section",
      sectionNumber: n,
      title: sec.name,
      moment: `Capítulo ${n} · segunda gráfica de la sección.`,
      visualization: ch ? ch.capB : "Gráfica complementaria de la sección.",
      script: ch
        ? `Siguiente ángulo: ${ch.headline}`
        : `Profundicemos en un segundo indicador de ${sec.name}.`,
    });

    blocks.push({
      kind: "sheet",
      title: sec.name,
      moment: `Hoja completa al cerrar «${sec.name}».`,
      visualization: "Índice con las gráficas y tablas de la sección.",
      script: `Abrimos la hoja completa de ${sec.name} para ubicar cada visualización en contexto antes de confirmar si quedó claro.`,
    });

    blocks.push({
      kind: "pause",
      moment: `Tras la sección ${n} («${sec.name}»), antes del siguiente capítulo.`,
      script:
        "Antes de continuar, ¿tienen alguna pregunta sobre lo que acabamos de revisar?",
    });

    if (i < script.sections.length - 1) {
      const next = script.sections[i + 1];
      blocks.push({
        kind: "transition",
        script: `Gracias. Pasemos ahora a ${next.name}.`,
      });
    }
  });

  blocks.push({
    kind: "closing",
    moment: "Paso final de la reunión.",
    visualization: "Resumen, preguntas anónimas y cierre.",
    script:
      "Para cerrar, repasemos los puntos más relevantes de la sesión y abrimos espacio para las preguntas que hayan dejado en la sala. Gracias por su tiempo.",
  });

  return blocks;
}
