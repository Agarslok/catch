import type { MonitorAiChatErrorBody, MonitorAiErrorCode } from "./types";
import { MONITOR_AI_CONTRACT_VERSION } from "./types";

const HTTP_BY_CODE: Record<MonitorAiErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  CONTEXT_TOO_LARGE: 413,
  AI_TIMEOUT: 504,
  AI_PROVIDER_ERROR: 502,
  AI_EMPTY_RESPONSE: 502,
  SERVICE_UNAVAILABLE: 503,
};

const SAFE_MESSAGES: Partial<Record<MonitorAiErrorCode, string>> = {
  INVALID_REQUEST: "La solicitud no es válida.",
  UNAUTHORIZED: "No autorizado para esta reunión.",
  FORBIDDEN: "No tiene permiso para usar el asistente en esta reunión.",
  RATE_LIMITED: "Demasiadas solicitudes. Intente de nuevo en unos minutos.",
  CONTEXT_TOO_LARGE: "El contexto enviado es demasiado grande.",
  AI_TIMEOUT: "El asistente tardó demasiado en responder.",
  AI_PROVIDER_ERROR: "El asistente no está disponible en este momento.",
  AI_EMPTY_RESPONSE: "El asistente no devolvió una respuesta.",
  SERVICE_UNAVAILABLE: "El servicio no está disponible.",
};

export function monitorAiErrorResponse(
  code: MonitorAiErrorCode,
  message?: string,
): { status: number; body: MonitorAiChatErrorBody } {
  return {
    status: HTTP_BY_CODE[code],
    body: {
      contract: MONITOR_AI_CONTRACT_VERSION,
      error: {
        code,
        message: message ?? SAFE_MESSAGES[code] ?? "Error al procesar la solicitud.",
      },
    },
  };
}
