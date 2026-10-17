/** Términos del Monitor HTML, reutilizados en la app Next. */
export const GLOSSARY: Record<string, string> = {
  "Promedio simple":
    "Promedio de las compañías, donde cada empresa pesa lo mismo sin importar su tamaño.",
  "Sin ceros":
    "Se excluyen las compañías que reportaron 0 o no reportaron, como en el Monitor.",
  Mediana:
    "Valor del medio: la mitad de las empresas está por arriba y la mitad por abajo.",
  Rotación: "Bajas del bimestre divididas entre los empleados operativos y administrativos.",
  "Rotación no controlada":
    "Bajas que decide el empleado: renuncia voluntaria y abandono.",
  "Rotación controlada":
    "Bajas que decide la compañía: rescisión, disminución de plazas y acumulación de faltas.",
  Tier:
    "Nivel en la cadena automotriz: Tier 1 surte directo a la armadora (OEM); Tier 2 surte a un Tier 1.",
  "Ponderado por empleados": "Cada empresa pesa según su número de empleados.",
  "Escalera salarial":
    "Distancia entre el salario inicial y el máximo de la categoría operativa.",
  "Percentil 25 y 75":
    "El 25% de las empresas paga menos que el percentil 25; el 75% paga menos que el percentil 75.",
  Ausentismo:
    "Faltas divididas entre empleados por días hábiles del bimestre.",
  Incremento:
    "Porcentaje de aumento otorgado en el año a salarios o beneficios.",
  "Contrato colectivo":
    "Acuerdo entre la empresa y el sindicato que fija salarios y prestaciones; se revisa cada año.",
  Benchmark:
    "Comparación de su empresa contra el resto del mercado que participa en el Monitor.",
  Controlada: "Rotación decidida por la empresa (rescisiones, ajustes de plantilla).",
  "No controlada": "Rotación decidida por el empleado (renuncia o abandono).",
};

export function glossaryTermsForChapter(chartFocus: string): string[] {
  const byFocus: Record<string, string[]> = {
    turnover_bimonthly: ["Rotación", "Rotación controlada", "Rotación no controlada", "Benchmark"],
    turnover_municipality: ["Rotación", "Benchmark"],
    turnover_tenure: ["Rotación", "Mediana"],
    hiring_mix: ["Benchmark", "Promedio simple"],
  };
  return byFocus[chartFocus] ?? ["Benchmark", "Rotación"];
}
