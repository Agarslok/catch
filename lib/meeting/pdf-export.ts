import { jsPDF } from "jspdf";
import {
  buildAvatarDemoScript,
  type AvatarScriptBlock,
} from "@/lib/meeting/avatar-demo-script";
import type { SessionScript } from "@/lib/meeting/script-types";

export type PdfSessionMeta = {
  editionLabel: string;
  clientLabel: string;
  meetingId?: string;
  sectionNames: string[];
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pdfWriter(doc: jsPDF) {
  const W = 210;
  const X = 16;
  let y = 20;
  const titulo = (t: string, tam = 16) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(tam);
    doc.setTextColor(12, 47, 106);
    doc.text(t, X, y);
    y += tam * 0.5 + 2;
  };
  const parrafo = (t: string, tam = 10) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(tam);
    doc.setTextColor(16, 34, 63);
    const lines = doc.splitTextToSize(t, W - 2 * X);
    if (y + lines.length * 5 > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, X, y);
    y += lines.length * tam * 0.45 + 3;
  };
  return { titulo, parrafo, nuevaPagina: () => { doc.addPage(); y = 20; } };
}

export function buildCatchFeedbackPdf(meta: PdfSessionMeta): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { titulo, parrafo } = pdfWriter(doc);
  const fecha = new Date().toLocaleString("es-MX");

  titulo("Catch — Feedback interno de sesión", 18);
  parrafo(
    "Documento de demostración. Combina datos locales de la sesión con observaciones de ejemplo. No sustituye un informe oficial de Catch ni afirma análisis que aún no estén integrados en el producto.",
    9,
  );
  parrafo(
    `Monitor de Mercado Laboral · ${meta.editionLabel} · Referencia cliente: ${meta.clientLabel}${meta.meetingId ? ` · Reunión ${meta.meetingId}` : ""} · ${fecha}`,
  );

  titulo("Resumen ejecutivo (simulado)", 13);
  parrafo(
    "La dinámica de la sesión sugiere buena recepción en indicadores y rotación; conviene profundizar en beneficios y claridad de escalera salarial en el siguiente contacto.",
  );
  parrafo(
    "Nivel de engagement estimado (ejemplo): medio-alto. Riesgo detectado (ejemplo): posibles dudas no verbalizadas en la sección de compensación.",
  );

  titulo("Temas cubiertos", 13);
  meta.sectionNames.forEach((name) => parrafo(`• ${name} — cubierto en agenda de la sesión.`));

  titulo("Observaciones internas (ejemplo)", 13);
  parrafo(
    "• Priorizar seguimiento con el cliente sobre rotación no controlada y posición percentil.\n• Registrar en CRM el interés en comparar beneficios frente al mercado.\n• Validar con el equipo de consultoría si se requiere profundización en sindicalización.",
  );

  titulo("Notas para consultoría Catch", 13);
  parrafo(
    "Este PDF es solo para uso interno. No compartir con el cliente. La versión para cliente se genera por separado y excluye estas secciones.",
  );

  return doc.output("blob");
}

export function buildClientSessionPdf(
  script: SessionScript,
  meta: PdfSessionMeta,
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { titulo, parrafo, nuevaPagina } = pdfWriter(doc);
  const fecha = new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  titulo("Monitor de Mercado Laboral", 20);
  parrafo(`${meta.editionLabel} · Informe para ${meta.clientLabel}`);
  parrafo(`Fecha de sesión: ${fecha}`);
  parrafo(
    "Resumen comparativo con el mercado de referencia. Las cifras provienen de la edición del monitor presentada en la reunión. Documento de demostración con estructura de entrega al cliente.",
  );

  for (const sec of script.sections) {
    nuevaPagina();
    titulo(sec.name, 15);
    parrafo(sec.summary || "Resumen de la sección presentada en la sesión.");
    parrafo(
      "Hallazgos clave (ejemplo): su empresa se ubica en el contexto del mercado analizado; los detalles gráficos se revisaron en la sesión en vivo.",
      9,
    );
  }

  nuevaPagina();
  titulo("Próximos pasos", 14);
  parrafo(
    "Conserve este resumen como referencia. Para profundizar en algún indicador, contacte a su consultor Catch o solicite una sesión de seguimiento.",
  );
  parrafo("Catch Consulting · HR Toolkit · Monitor de Mercado Laboral");

  return doc.output("blob");
}

export function downloadCatchFeedbackPdf(meta: PdfSessionMeta) {
  const blob = buildCatchFeedbackPdf(meta);
  const safe = meta.editionLabel.replace(/\s+/g, "_");
  downloadBlob(blob, `Catch_Feedback_Interno_${safe}.pdf`);
}

export function downloadClientSessionPdf(script: SessionScript, meta: PdfSessionMeta) {
  const blob = buildClientSessionPdf(script, meta);
  const safe = meta.editionLabel.replace(/\s+/g, "_");
  downloadBlob(blob, `Monitor_Catch_Cliente_${safe}.pdf`);
}

function blockToPdfLines(block: AvatarScriptBlock): string[] {
  switch (block.kind) {
    case "opening":
      return [
        `${block.title}`,
        `Momento: ${block.moment}`,
        `Visualización: ${block.visualization}`,
        `Guion: «${block.script}»`,
      ];
    case "section":
      return [
        `Sección ${block.sectionNumber} — ${block.title}`,
        `Momento: ${block.moment}`,
        `Visualización: ${block.visualization}`,
        `Guion: «${block.script}»`,
      ];
    case "sheet":
      return [
        `Hoja completa — ${block.title}`,
        `Momento: ${block.moment}`,
        `Visualización: ${block.visualization}`,
        `Guion: «${block.script}»`,
      ];
    case "pause":
      return [
        "Pausa para preguntas",
        `Momento: ${block.moment}`,
        `Guion: «${block.script}»`,
      ];
    case "transition":
      return [`Transición: «${block.script}»`];
    case "closing":
      return [
        "Cierre",
        `Momento: ${block.moment}`,
        `Visualización: ${block.visualization}`,
        `Guion: «${block.script}»`,
      ];
    default:
      return [];
  }
}

export function buildAvatarScriptPdf(
  script: SessionScript,
  meta: PdfSessionMeta,
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { titulo, parrafo } = pdfWriter(doc);
  const blocks = buildAvatarDemoScript(script);

  titulo("Guion de la reunión — Catch", 18);
  parrafo("Guion de demostración con contenido simulado.", 9);
  parrafo(
    `${meta.editionLabel} · Uso interno del presentador · ${meta.clientLabel}${meta.meetingId ? ` · Reunión ${meta.meetingId}` : ""}`,
  );
  parrafo(
    "Este documento no se comparte con el cliente ni sustituye el guion operativo del avatar en producción.",
    9,
  );

  for (const block of blocks) {
    titulo(
      block.kind === "section"
        ? `Sección ${block.sectionNumber}`
        : block.kind === "pause"
          ? "Pausa"
          : block.kind === "transition"
            ? "Transición"
            : block.kind === "opening"
              ? "Inicio"
              : block.kind === "closing"
                ? "Cierre"
                : "Hoja completa",
      12,
    );
    blockToPdfLines(block).forEach((line) => parrafo(line, 10));
  }

  return doc.output("blob");
}

export function downloadAvatarScriptPdf(script: SessionScript, meta: PdfSessionMeta) {
  const blob = buildAvatarScriptPdf(script, meta);
  const safe = meta.editionLabel.replace(/\s+/g, "_");
  downloadBlob(blob, `Catch_Guion_Avatar_${safe}.pdf`);
}
