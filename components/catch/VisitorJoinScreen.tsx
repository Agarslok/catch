"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import {
  newVisitorParticipantId,
  readRegisterAttempt,
  readVisitorToken,
  type VisitorActor,
  writeRegisterAttempt,
  writeVisitorSession,
} from "@/lib/meeting/visitor-session";
import { normalizeVisitorDisplayName } from "@/lib/meeting/visitor-register";

type Props = {
  meetingId: string;
  onJoined: (actor: VisitorActor, token: string) => void;
};

export function VisitorJoinScreen({ meetingId, onJoined }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(async () => {
    const displayName = normalizeVisitorDisplayName(name);
    if (!displayName) {
      setError("Escriba su nombre para continuar.");
      return;
    }
    setError("");
    setLoading(true);

    const prior = readRegisterAttempt(meetingId);
    const participantId =
      prior?.displayName === displayName ? prior.participantId : newVisitorParticipantId();
    writeRegisterAttempt(meetingId, { participantId, displayName });

    try {
      const res = await fetch(
        `/api/meeting/${encodeURIComponent(meetingId)}/visitor-register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName,
            participantId,
            existingToken: readVisitorToken(meetingId) || undefined,
          }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        participantId?: string;
        displayName?: string;
        token?: string;
      };
      if (res.ok && data.token && data.participantId) {
        const actor = {
          id: data.participantId,
          name: data.displayName ?? displayName,
        };
        writeVisitorSession(meetingId, actor, data.token);
        onJoined(actor, data.token);
        return;
      }

      if (res.status === 404 || res.status >= 500) {
        const fallback = await fetch(
          `/api/meeting/${encodeURIComponent(meetingId)}/participant-token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              participantId,
              existingToken: readVisitorToken(meetingId) || undefined,
            }),
          },
        );
        const tokenData = (await fallback.json()) as {
          error?: string;
          participantId?: string;
          token?: string;
        };
        if (!fallback.ok || !tokenData.token) {
          setError(tokenData.error ?? data.error ?? "No se pudo registrar su ingreso. Intente de nuevo.");
          setLoading(false);
          return;
        }
        const actor = {
          id: tokenData.participantId ?? participantId,
          name: displayName,
        };
        writeVisitorSession(meetingId, actor, tokenData.token);
        onJoined(actor, tokenData.token);
        return;
      }

      setError(data.error ?? "No se pudo registrar su ingreso. Intente de nuevo.");
      setLoading(false);
      return;
    } catch {
      setError("Error de conexión. Compruebe la red e intente de nuevo.");
      setLoading(false);
    }
  }, [meetingId, name, onJoined]);

  return (
    <div className="visitor-join-shell">
      <div className="visitor-join-card">
        <Image src="/favicon.png" alt="" width={48} height={48} aria-hidden />
        <p className="visitor-join-eyebrow">Capital Humano Live</p>
        <h1 className="visitor-join-title">Ingresa a la reunión</h1>
        <p className="visitor-join-lead">
          Escribe tu nombre para participar en esta sesión
        </p>
        <label className="visitor-join-field">
          <span>Tu nombre</span>
          <input
            type="text"
            name="displayName"
            autoComplete="name"
            value={name}
            disabled={loading}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="Ej. María López"
          />
        </label>
        {error ? (
          <p className="visitor-join-error" role="alert">{error}</p>
        ) : null}
        <button
          type="button"
          className="visitor-join-submit"
          disabled={loading}
          onClick={() => void submit()}
        >
          {loading ? "Registrando…" : "Ingresar a la reunión"}
        </button>
        <p className="visitor-join-meta">
          Reunión <code>{meetingId}</code>
        </p>
      </div>
    </div>
  );
}
