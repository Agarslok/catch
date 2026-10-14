import Image from "next/image";
import Link from "next/link";

const DEFAULT_MEETING = "demo-q3-2026";

export default function HomePage() {
  return (
    <div className="landing">
      <Image src="/favicon.png" alt="Catch Consulting" width={64} height={64} />
      <h1>Capital Humano Live</h1>
      <p>
        Presentación sincronizada con Supabase (tiempo real) y despliegue en Netlify. Abre el
        presentador en un equipo y los visitantes en móviles u otras pestañas.
      </p>
      <div className="choices">
        <Link
          className="link-btn primary"
          href={`/meeting/${DEFAULT_MEETING}/presenter`}
        >
          Vista presentador
        </Link>
        <Link className="link-btn outline" href={`/meeting/${DEFAULT_MEETING}/visitor`}>
          Vista visitante
        </Link>
      </div>
      <p style={{ fontSize: 13 }}>
        Reunión demo: <code>{DEFAULT_MEETING}</code> ·{" "}
        <Link href="/legacy/catch-live%20(3).html">versión HTML estática</Link>
      </p>
    </div>
  );
}
