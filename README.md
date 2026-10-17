# catchdos

**Capital Humano Live** — presentación interactiva (Catch Consulting) con Next.js, ECharts, Supabase (tiempo real + historial) y despliegue en Netlify.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- ECharts (barras, torta, interacciones)
- Supabase (`meeting_state`, `meeting_activity`, Realtime)
- Netlify (`@netlify/plugin-nextjs`)

## Desarrollo local

```bash
cp .env.example .env.local
# Completa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

- Inicio: http://localhost:3000/
- Presentador: `/meeting/demo-q3-2026/presenter`
- Visitante: `/meeting/demo-q3-2026/visitor`

Sin variables Supabase, la app usa **modo local** (`localStorage` + `BroadcastChannel`) como el HTML legacy.

## Supabase

Ejecuta en el SQL Editor de tu proyecto Supabase (**Catch**):

1. Si la base es nueva: `supabase/migrations/20260313180000_meeting_realtime.sql`
2. Si ya tienes `meeting_activity` pero falla RLS o falta `meeting_state`:  
   `supabase/migrations/20260313200000_catch_cuelrmx_patch.sql`
3. **Reunión / moderador / monitor (obligatorio en producción):** aplica el resto de `supabase/migrations/` en orden de fecha, o desde la raíz del repo:

   ```bash
   # Contraseña: Supabase → Project Settings → Database
   set SUPABASE_DB_PASSWORD=tu_password
   npm run db:push
   ```

   Incluye `meeting_questions`, `meeting_participants`, columnas `event_seq` / `script` en `meeting_state`, etc.

   Alternativa manual: pegar y ejecutar **`supabase/catch_production_catchup.sql`** en el SQL Editor.

Tablas:

- `meeting_state` — paso global y desbloqueo (`current_step`, `unlocked_step`)
- `meeting_activity` — eventos (`CHART_VIEWED`, `CHART_SELECTED`, `QUESTION_ASKED`, `AI_RESPONSE`, `PRESENTATION_STEP`, …)

Habilita **Realtime** para ambas tablas si el `ALTER PUBLICATION` falla (Dashboard → Database → Replication).

**Probar conexión:**

```bash
curl -s http://localhost:3000/api/supabase/health
# o en Netlify: curl -s https://TU-SITIO.netlify.app/api/supabase/health
```

Esperado: `"ok": true`. En la app, el badge muestra **Supabase conectado · tiempo real**.

## Netlify

1. Conecta el repo en Netlify.
2. Build command: `npm run build` y **Publish directory:** `.next` (definido en `netlify.toml`).  
   Si en la UI tenías el publish en la raíz del repo, cámbialo a `.next` o déjalo vacío para que use el TOML.
3. Variables de entorno (scope **Build** y **Functions**): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MEETING_PRESENTER_SECRET`, `GEMINI_API_KEY`, y opcionalmente `GEMINI_MODEL_ID` (p. ej. `gemini-3.5-flash-lite`).

## Legacy

La versión HTML monolítica anterior está en `public/legacy/catch-live (3).html`.

## Assets

- `public/avatar.mp4` — avatar IA
- `public/favicon.png`
