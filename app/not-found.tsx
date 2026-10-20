import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: "48px 24px", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Página no encontrada</h1>
      <p style={{ marginBottom: 24, color: "var(--muted, #666)" }}>
        La ruta que buscas no existe en Catch.
      </p>
      <Link href="/">Volver al inicio</Link>
    </main>
  );
}
