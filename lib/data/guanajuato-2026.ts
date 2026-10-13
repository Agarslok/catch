export type Chapter = {
  n: string;
  t: string;
  eyebrow: string;
  headline: string;
  big: string;
  sub: string;
  s1v: string;
  s1l: string;
  s2v: string;
  s2l: string;
  capA: string;
  capB: string;
  chartFocus: string;
  presentationEventId: string;
};

export const TOTAL_STEPS = 8;

export const CHAPTERS: Chapter[] = [
  {
    n: "01",
    t: "Rotación",
    eyebrow: "Capítulo 01 · Rotación",
    headline: "La rotación bajó casi 2 puntos frente a 2025.",
    big: "7.24%",
    sub: "Rotación acumulada de enero–febrero 2026, promedio de las 47 compañías con dato.",
    s1v: "2.68%",
    s1l: "controlada · decide la empresa",
    s2v: "4.56%",
    s2l: "no controlada · decide el empleado",
    capA: "Así se movió la rotación bimestral durante 2025: entre 5.10% y 9.29%.",
    capB: "Enero–febrero 2026 cerró en 7.24%, casi 2 puntos por debajo del mismo bimestre de 2025.",
    chartFocus: "turnover_bimonthly",
    presentationEventId: "pe-rotacion-general",
  },
  {
    n: "02",
    t: "Dónde",
    eyebrow: "Capítulo 02 · Dónde",
    headline: "San Francisco del Rincón casi duplica el promedio.",
    big: "13.00%",
    sub: "Rotación de San Francisco del Rincón frente a un promedio general de 7.24%.",
    s1v: "610",
    s1l: "vacantes para marzo–abril en el municipio",
    s2v: "4,712",
    s2l: "empleados en la muestra",
    capA: "Ocho municipios reportan rotación en esta edición; Salamanca no tiene dato.",
    capB: "San Francisco del Rincón llega a 13% y concentra casi la mitad de las vacantes del siguiente bimestre.",
    chartFocus: "turnover_municipality",
    presentationEventId: "pe-rotacion-municipio",
  },
  {
    n: "03",
    t: "Quién se va",
    eyebrow: "Capítulo 03 · Quién se va",
    headline: "Las bajas se concentran en el primer año.",
    big: "60%",
    sub: "de las bajas fueron de personas con menos de un año en la compañía.",
    s1v: "60%",
    s1l: "de las bajas, menores de 30 años",
    s2v: "24%",
    s2l: "se van entre los 3 y 12 meses",
    capA: "Estas son las bajas del bimestre según cuánto tiempo llevaban en la compañía.",
    capB: "Seis de cada diez llevaban menos de un año. El reto no es retener veteranos: es sostener el primer año.",
    chartFocus: "turnover_tenure",
    presentationEventId: "pe-bajas-antiguedad",
  },
  {
    n: "04",
    t: "Qué cuesta",
    eyebrow: "Capítulo 04 · Qué cuesta",
    headline: "Contratamos para reponer, no para crecer.",
    big: "8 de 10",
    sub: "contrataciones de enero–febrero 2026 fueron para cubrir bajas.",
    s1v: "2,208",
    s1l: "contrataciones en el bimestre",
    s2v: "$11,044",
    s2l: "costo mensual promedio por fuente de reclutamiento",
    capA: "En enero–febrero se hicieron 2,208 contrataciones. ¿Cuántas fueron para crecer?",
    capB: "Solo 2 de cada 10. Las otras 8 repusieron a alguien que se fue: bajar la rotación temprana es bajar el costo de reclutar.",
    chartFocus: "hiring_mix",
    presentationEventId: "pe-contrataciones",
  },
];

export const D1: [string, number][] = [
  ["Ene–Feb", 9.29],
  ["Mar–Abr", 7.1],
  ["May–Jun", 8.18],
  ["Jul–Ago", 8.56],
  ["Sep–Oct", 7.3],
  ["Nov–Dic", 5.1],
];

export type MunicipalityRow = [string, number, number, number];

export const MU: MunicipalityRow[] = [
  ["San Francisco del Rincón", 5.27, 7.73, 13.0],
  ["Celaya", 1.94, 7.42, 9.36],
  ["Romita", 6.58, 2.65, 9.23],
  ["Silao", 3.62, 5.59, 9.21],
  ["León", 1.49, 5.07, 6.56],
  ["Apaseo el Grande", 1.1, 5.01, 6.11],
  ["Irapuato", 1.88, 3.94, 5.82],
  ["Villagrán", 1.64, 2.6, 4.24],
];

export const D2: [string, number][] = [
  ["0–1 mes", 20],
  ["1–3 meses", 16],
  ["3–12 meses", 24],
  ["1–3 años", 22],
  ["> 3 años", 18],
];

export type MunFilter = "total" | "controlada" | "nocontrolada";

export type ChartKind = "bar" | "pie";
