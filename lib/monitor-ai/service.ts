import { createGeminiProvider } from "./providers/gemini";
import { runMonitorAiChatWithTools } from "./run-with-tools";
import type { MonitorAiChatSuccess, MonitorAiErrorCode, MonitorAiValidatedRequest } from "./types";

export type MonitorAiServiceResult =
  | { ok: true; body: MonitorAiChatSuccess }
  | { ok: false; code: MonitorAiErrorCode };

export async function runMonitorAiChat(
  validated: MonitorAiValidatedRequest,
): Promise<MonitorAiServiceResult> {
  if (!createGeminiProvider()) {
    return { ok: false, code: "SERVICE_UNAVAILABLE" };
  }
  return runMonitorAiChatWithTools(validated);
}
