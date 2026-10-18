import { MONITOR_AI_TOOL_DECLARATIONS } from "../tools/definitions";
function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

function getModelId(): string {
  return process.env.GEMINI_MODEL_ID?.trim() || "gemini-2.0-flash";
}

function getTimeoutMs(): number {
  const n = Number(process.env.GEMINI_TIMEOUT_MS);
  if (!Number.isFinite(n) || n < 1000) return 28_000;
  return Math.min(n, 120_000);
}

export const MAX_TOOL_ITERATIONS = 3;

type FunctionCallPart = {
  name: string;
  args?: Record<string, unknown>;
  id?: string;
};

/** Parte tal como la devuelve Gemini (incl. thoughtSignature cuando aplica). */
export type GeminiModelContentPart = {
  functionCall: FunctionCallPart;
  thoughtSignature?: string;
};

type ContentPart =
  | { text: string; thoughtSignature?: string }
  | GeminiModelContentPart
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type Content = { role: string; parts: ContentPart[] };

type GenerateResponse = {
  candidates?: Array<{
    content?: { parts?: ContentPart[] };
    finishReason?: string;
  }>;
};

export type GeminiToolRound =
  | { type: "text"; text: string }
  | {
      type: "function_call";
      name: string;
      args: Record<string, unknown>;
      modelPart: GeminiModelContentPart;
    };

type GeminiApiError = {
  error?: { message?: string; code?: number; status?: string };
};

function logGeminiFailure(
  stage: "generate",
  info: {
    model: string;
    withTools: boolean;
    httpStatus?: number;
    providerStatus?: string;
    providerCode?: number;
    providerMessage?: string;
    cause?: string;
  },
): void {
  if (process.env.NODE_ENV === "production" && !process.env.MONITOR_AI_DEBUG) return;
  console.error("[monitor-ai] gemini", stage, {
    model: info.model,
    withTools: info.withTools,
    httpStatus: info.httpStatus,
    providerStatus: info.providerStatus,
    providerCode: info.providerCode,
    providerMessage: info.providerMessage?.slice(0, 500),
    cause: info.cause,
  });
}

export type GeminiGenerateOptions = {
  responseJson?: boolean;
  maxOutputTokens?: number;
};

export async function geminiGenerate(
  systemInstruction: string,
  contents: Content[],
  withTools: boolean,
  options?: GeminiGenerateOptions,
): Promise<
  | { ok: true; round: GeminiToolRound }
  | { ok: false; code: "AI_TIMEOUT" | "AI_PROVIDER_ERROR" | "AI_EMPTY_RESPONSE" | "RATE_LIMITED" }
> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, code: "AI_PROVIDER_ERROR" };
  }

  const model = getModelId();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options?.maxOutputTokens ?? 512,
  };
  if (options?.responseJson) {
    generationConfig.responseMimeType = "application/json";
  }

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig,
  };
  if (withTools) {
    body.tools = [{ functionDeclarations: MONITOR_AI_TOOL_DECLARATIONS }];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 429) {
      return { ok: false, code: "RATE_LIMITED" };
    }
    const rawText = await res.text();
    if (!res.ok) {
      let apiErr: GeminiApiError = {};
      try {
        apiErr = JSON.parse(rawText) as GeminiApiError;
      } catch {
        /* ignore */
      }
      logGeminiFailure("generate", {
        model,
        withTools,
        httpStatus: res.status,
        providerStatus: apiErr.error?.status,
        providerCode: apiErr.error?.code,
        providerMessage: apiErr.error?.message,
      });
      return { ok: false, code: "AI_PROVIDER_ERROR" };
    }

    const data = JSON.parse(rawText) as GenerateResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const fn = parts.find((p): p is GeminiModelContentPart => "functionCall" in p);
    if (fn?.functionCall) {
      return {
        ok: true,
        round: {
          type: "function_call",
          name: fn.functionCall.name,
          args: fn.functionCall.args ?? {},
          modelPart: fn,
        },
      };
    }
    const textPart = parts.find((p): p is { text: string } => "text" in p && typeof p.text === "string");
    const text = textPart?.text?.trim() ?? "";
    if (!text) {
      return { ok: false, code: "AI_EMPTY_RESPONSE" };
    }
    return { ok: true, round: { type: "text", text } };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, code: "AI_TIMEOUT" };
    }
    logGeminiFailure("generate", {
      model,
      withTools,
      cause: e instanceof Error ? e.name : "unknown",
    });
    return { ok: false, code: "AI_PROVIDER_ERROR" };
  } finally {
    clearTimeout(timer);
  }
}
