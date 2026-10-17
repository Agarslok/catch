# Fase 2: contexto del monitor en servidor

Hoy el monitor construye el contexto con `contextoIA()` en `public/monitor-v3/monitor-en-vivo-catch.html`, usando `DATOS` / `EMP` / `SECCIONES` embebidos.

**No duplicar** esas definiciones en esta fase.

Pasos futuros recomendados:

1. Extraer `DATOS` y helpers (`mercado`, KPIs, narrativas por gráfica) a un módulo compartido (por ejemplo `lib/monitor-data/`).
2. Importar ese módulo desde el HTML vía build step **o** servir un bundle; y desde `lib/monitor-ai/context-server.ts` para generar el mismo texto que `contextoIA(s)`.
3. El cliente enviaría solo `sectionIndex`, `chartId` y metadatos; el servidor validaría y generaría `contextForProvider` sin confiar en `contextBlock`.

Hasta entonces, `contextBlock` sigue siendo entrada no confiable con límites de tamaño y prompt de referencia.
