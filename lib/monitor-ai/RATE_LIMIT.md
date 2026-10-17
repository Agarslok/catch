# Límite de uso (pendiente persistencia)

La arquitectura aprobada exige límites por usuario y reunión sin depender de memoria local en producción.

**Estado v1:** no hay tabla ni servicio de rate limiting en el repo. Esta versión aplica solo:

- Límites de tamaño (`MAX_QUESTION_LENGTH`, `MAX_CONTEXT_BLOCK_BYTES`, `MAX_RESPONSE_MESSAGE_LENGTH`)
- Timeout de proveedor (`GEMINI_TIMEOUT_MS`)
- Rechazo ante HTTP 429 de Gemini (`RATE_LIMITED`)

**Alternativa mínima (requiere migración Supabase, no implementada):**

- Tabla `meeting_ai_usage` con `(meeting_id, participant_id, window_start, request_count)` o ventana deslizante en Redis/Upstash.
- Incremento atómico antes de llamar a Gemini; si supera umbral (p. ej. 20/hora/participante), responder `429` con `RATE_LIMITED`.

No se modificaron políticas RLS ni tablas en la fase actual.
