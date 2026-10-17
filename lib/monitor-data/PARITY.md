# Paridad monitor HTML ↔ `lib/monitor-data`

El monitor operativo sigue calculando en `public/monitor-v3/monitor-en-vivo-catch.html`.  
`lib/monitor-data/datos.json` se extrae de `DATOS` con `node scripts/extract-monitor-datos.mjs`.

**Comprobación de equivalencia:**

1. Tras cambiar `DATOS` en el HTML, regenerar `datos.json`.
2. Ejecutar `npm test` — las pruebas en `lib/monitor-data/parity.test.ts` comparan contra `reference-stats.ts` (port literal de las funciones del HTML, solo para tests).
3. Revisar manualmente un KPI en UI vs `get_section_summary` si se modifica lógica de `SECCIONES`.

No hay import directo del HTML en Next.js; dos rutas de ejecución hasta una futura unificación (build bundle o generación compartida).
