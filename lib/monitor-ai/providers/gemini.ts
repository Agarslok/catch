import type { MonitorAiProvider, MonitorAiProviderInput, MonitorAiProviderResult } from "./types";

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

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string; code?: number; status?: string };
};

export function createGeminiProvider(): MonitorAiProvider | null {
  if (!getApiKey()) return null;

  return {
    async complete(input: MonitorAiProviderInput): Promise<MonitorAiProviderResult> {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { ok: false, code: "AI_PROVIDER_ERROR" };
      }

      const model = getModelId();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

      const body = {
        systemInstruction: {
          parts: [{ text: input.systemInstruction }],
        },
        contents: [{ role: "user", parts: [{ text: input.userText }] }],
        generationConfig: {
          maxOutputTokens: 256,
        },
      };

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

        if (!res.ok) {
          return { ok: false, code: "AI_PROVIDER_ERROR" };
        }

        const data = (await res.json()) as GeminiGenerateResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        if (!text) {
          return { ok: false, code: "AI_EMPTY_RESPONSE" };
        }
        return { ok: true, text };
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return { ok: false, code: "AI_TIMEOUT" };
        }
        return { ok: false, code: "AI_PROVIDER_ERROR" };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
