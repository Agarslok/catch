export type MonitorAiProviderInput = {
  systemInstruction: string;
  userText: string;
};

export type MonitorAiProviderResult =
  | { ok: true; text: string }
  | { ok: false; code: "AI_TIMEOUT" | "AI_PROVIDER_ERROR" | "AI_EMPTY_RESPONSE" | "RATE_LIMITED" };

export interface MonitorAiProvider {
  complete(input: MonitorAiProviderInput): Promise<MonitorAiProviderResult>;
}
