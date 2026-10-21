"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import {
  grantPresenterAccess,
  verifyPresenterAccessPassword,
} from "@/lib/meeting/demo-access-gate";

type Props = {
  onUnlocked: () => void;
  /** presenter = panel moderador; async = exploración asincrónica (misma contraseña). */
  context?: "presenter" | "async";
};

const COPY = {
  presenter: {
    title: "Vista de presentador",
    lead: "Ingrese la contraseña para abrir el panel de moderador",
  },
  async: {
    title: "Modo asincrónico",
    lead: "Ingrese la contraseña de demostración para continuar",
  },
} as const;

export function DemoAccessGateScreen({ onUnlocked, context = "presenter" }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = useCallback(() => {
    if (!verifyPresenterAccessPassword(password)) {
      setError("Contraseña incorrecta. Intente de nuevo.");
      return;
    }
    setError("");
    grantPresenterAccess();
    onUnlocked();
  }, [onUnlocked, password]);

  return (
    <div className="visitor-join-shell">
      <div className="visitor-join-card">
        <Image src="/favicon.png" alt="" width={48} height={48} aria-hidden />
        <p className="visitor-join-eyebrow">Capital Humano Live</p>
        <h1 className="visitor-join-title">{COPY[context].title}</h1>
        <p className="visitor-join-lead">{COPY[context].lead}</p>
        <label className="visitor-join-field">
          <span>Contraseña</span>
          <input
            type="password"
            name="demoAccessPassword"
            autoComplete="off"
            inputMode="numeric"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Contraseña"
          />
        </label>
        {error ? (
          <p className="visitor-join-error" role="alert">{error}</p>
        ) : null}
        <button type="button" className="visitor-join-submit" onClick={submit}>
          Continuar
        </button>
        <p className="visitor-join-meta">Acceso local en este navegador (sin registro)</p>
      </div>
    </div>
  );
}
