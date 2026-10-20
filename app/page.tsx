import Image from "next/image";
import Link from "next/link";

const DEFAULT_MEETING = "demo-q3-2026";

export default function HomePage() {
  return (
    <div className="landing">
      <Image src="/favicon.png" alt="Catch Consulting" width={64} height={64} />
      <p className="landing-eyebrow">Capital Humano Live</p>
      <h1 className="landing-hero">Monitor en vivo</h1>
      <p className="landing-lead">
        Presentación sincronizada con Supabase Realtime. Abra el moderador en una pestaña y el
        cliente en otra para seguir la misma sesión.
      </p>
      <div className="choices choices--hero">
        <Link className="link-btn link-btn--hero primary" href={`/monitor/${DEFAULT_MEETING}/presenter`}>
          Moderador · Monitor
        </Link>
        <Link className="link-btn link-btn--hero outline" href={`/monitor/${DEFAULT_MEETING}/visitor`}>
          Cliente · Monitor
        </Link>
        <Link className="link-btn link-btn--hero link-btn--async" href="/async">
          Modo asincrónico
        </Link>
      </div>
      <p className="landing-async-note">
        Explora los informes a tu propio ritmo e interactúa directamente con el avatar de IA, sin
        depender de una presentación en vivo.
      </p>
      <p className="landing-meta">
        Reunión demo: <code>{DEFAULT_MEETING}</code>
      </p>

      <details className="landing-legacy">
        <summary>Vistas clásicas (solo referencia)</summary>
        <div className="choices choices--legacy">
          <Link className="link-btn link-btn--tiny" href={`/meeting/${DEFAULT_MEETING}/presenter`}>
            Presentador clásico
          </Link>
          <Link className="link-btn link-btn--tiny outline" href={`/meeting/${DEFAULT_MEETING}/visitor`}>
            Visitante clásico
          </Link>
          <Link className="link-btn link-btn--tiny outline" href="/legacy/catch-live%20(3).html">
            HTML estático
          </Link>
        </div>
      </details>
    </div>
  );
}
