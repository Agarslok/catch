# Gemini + Tavus en el monitor

## Responsabilidades

- **Gemini** (`POST /api/monitor/{id}/chat`): interpreta preguntas **en texto** (escritas o transcritas por Web Speech API en el navegador). No recibe audio PCM directamente.
- **Tavus / Daily**: solo **salida** audiovisual del PAL. El cliente une la sala en modo **solo recepción** (`startAudioOff: true`, `setLocalAudio(false)`): el micrófono del navegador **no** se publica a Daily, para que el PAL no escuche al usuario por WebRTC.
- **Voz del avatar**: texto final de Gemini → `conversation.echo` vía `call.sendAppMessage` (no `conversation.respond`).

## Configuración externa (Tavus)

Si el PAL sigue respondiendo por su cuenta sin audio del usuario, revisa en el panel Tavus:

- Desactiva o limita el modo conversacional autónomo del PAL si tu plan lo expone.
- Usa un PAL orientado a **presentación / echo** más que a diálogo abierto.

El repositorio no puede desactivar el cerebro del PAL por API en el join; el aislamiento del micrófono hacia Daily es lo que garantiza el código.

## Clientes del monitor (visitante)

- Una sola conversación Tavus por reunión: credenciales de join en `meeting_state.global_view.monitorTavusSession` (Supabase Realtime).
- El presentador publica al crear/finalizar sesión; cliente y móvil se unen a la misma sala Daily en solo recepción (sin `speakEcho`).
- Volumen local: `sessionStorage` `catch-avatar-volume` por navegador.

## Contexto multi-turno

Cada petición a `/chat` es independiente (contexto de vista + pregunta actual). No hay historial de chat en esta versión.

## Narración del plan (Fase 3A / 6)

- **Texto**: `planMonitorNarration(stepIndex).speakText` (inyectado en shell moderador). Al entrar en un punto (tras `enviar('estado')` + render) el moderador orquesta resaltado Chart.js + `presentarGeminiEnFrida` → `speakEcho`. El visitante recibe el paso y el resaltado por Realtime; el audio de Tavus llega por Daily, no el texto completo. El botón «Probar narración en Tavus» sigue siendo un reintento manual.
- **Video MP4 local** (`/avatar_video.mp4`, `loop`): decorativo cuando Tavus no está conectado. **No** usar `ended` del `<video>` como fin de explicación.
- **Fin de réplica**: `monitor-tavus-cvi.js` no escucha un evento Daily/Tavus fiable de “terminó de hablar” tras `conversation.echo`. Por tanto **no hay auto-avance** al terminar el audio; `intentarAvanceDesdeNarracion` y `attemptNarrationAdvance` devuelven siempre bloqueo (`no_provider_end_signal`). El moderador avanza con Anterior/Siguiente o `continue_section` en interpret.
- **Pausa**: pausar video MP4 o `interrupt()` de Tavus debe marcar narración en `paused` y cancelar cualquier avance automático futuro.
- **Identificador de ejecución**: `narr-exec-{step}-{timestamp}` en `S.narracionRuntime.execId` para ignorar callbacks obsoletos.
