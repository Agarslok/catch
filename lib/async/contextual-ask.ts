export type AsyncContextMeta = {
  step: number;
  stepTotal: number;
  sectionName?: string;
  slideTitle?: string;
};

export type AsyncChartSelection = {
  kind: "chart";
  chartTitle?: string;
  category: string;
  value?: string;
  contentType?: string;
};

export type AsyncTextSelection = {
  kind: "text";
  selection: string;
};

export function buildAsyncChartQuestion(
  meta: AsyncContextMeta,
  sel: AsyncChartSelection,
): string {
  const paso = meta.step;
  const sec = meta.sectionName ? `, sección «${meta.sectionName}»` : "";
  const diapo = meta.slideTitle ? ` («${meta.slideTitle}»)` : "";
  const graf = sel.chartTitle ? `la gráfica «${sel.chartTitle}»` : "la gráfica actual";
  const elem = sel.category || "el elemento seleccionado";
  const val = sel.value ? ` Valor visible: ${sel.value}.` : "";
  const tipo = sel.contentType || "elemento";
  return `En el paso ${paso} de ${meta.stepTotal}${sec}${diapo}, en ${graf}, seleccioné ${tipo} «${elem}».${val} ¿Qué representa y cómo debe interpretarse según los datos de esta visualización?`;
}

export function buildAsyncTextQuestion(meta: AsyncContextMeta, sel: AsyncTextSelection): string {
  const paso = meta.step;
  const sec = meta.sectionName ? `, sección «${meta.sectionName}»` : "";
  const diapo = meta.slideTitle ? ` («${meta.slideTitle}»)` : "";
  return `En el paso ${paso} de ${meta.stepTotal}${sec}${diapo}, seleccioné el texto: «${sel.selection}». ¿Qué significa en este contexto y qué datos del informe lo respaldan?`;
}
