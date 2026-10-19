export type PrepFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export function prepFaqsStorageKey(meetingId: string): string {
  return `catch:${meetingId}:prepFaqs`;
}

export function newPrepFaqId(): string {
  return `faq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizePrepFaqRow(raw: unknown): PrepFaqItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) return null;
  const question =
    typeof row.question === "string"
      ? row.question
      : typeof row.pregunta === "string"
        ? row.pregunta
        : "";
  const answer =
    typeof row.answer === "string"
      ? row.answer
      : typeof row.respuesta === "string"
        ? row.respuesta
        : "";
  return { id, question, answer };
}

export function normalizePrepFaqs(raw: unknown): PrepFaqItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PrepFaqItem[] = [];
  for (const row of raw) {
    const item = normalizePrepFaqRow(row);
    if (item) out.push(item);
  }
  return out;
}

export function addPrepFaq(items: PrepFaqItem[], id = newPrepFaqId()): PrepFaqItem[] {
  return [...items, { id, question: "", answer: "" }];
}

export function updatePrepFaq(
  items: PrepFaqItem[],
  id: string,
  patch: Partial<Pick<PrepFaqItem, "question" | "answer">>,
): PrepFaqItem[] {
  return items.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export function removePrepFaq(items: PrepFaqItem[], id: string): PrepFaqItem[] {
  return items.filter((row) => row.id !== id);
}

/** Items with at least one non-empty field (for read-only display). */
export function prepFaqsForDisplay(items: PrepFaqItem[]): PrepFaqItem[] {
  return items.filter((row) => row.question.trim() || row.answer.trim());
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readStoredPrepFaqs(
  meetingId: string,
  storage?: StorageLike | null,
): PrepFaqItem[] {
  const store = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(prepFaqsStorageKey(meetingId));
    if (!raw) return [];
    return normalizePrepFaqs(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeStoredPrepFaqs(
  meetingId: string,
  items: PrepFaqItem[],
  storage?: StorageLike | null,
): void {
  const store = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  if (!store) return;
  try {
    store.setItem(prepFaqsStorageKey(meetingId), JSON.stringify(items));
  } catch {
    /* ignore quota / private mode */
  }
}

export const PREP_FAQS_POLL_MS = 8_000;
export const PREP_FAQ_QUESTION_MAX = 600;
export const PREP_FAQ_ANSWER_MAX = 4_000;

export type PrepFaqDbRow = {
  meeting_id: string;
  id: string;
  sort_order: number;
  question: string;
  answer: string;
};

/** Recorta y normaliza el cuerpo PUT; ignora filas de otra reunión. */
export function prepFaqsFromPutBody(meetingId: string, raw: unknown): PrepFaqItem[] {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).items ??
        (raw as Record<string, unknown>).faqs ??
        raw
      : raw;
  return normalizePrepFaqs(source).map((item) => ({
    id: item.id.slice(0, 80),
    question: item.question.slice(0, PREP_FAQ_QUESTION_MAX),
    answer: item.answer.slice(0, PREP_FAQ_ANSWER_MAX),
  }));
}

export function prepFaqDbRows(meetingId: string, items: PrepFaqItem[]): PrepFaqDbRow[] {
  return items.map((item, index) => ({
    meeting_id: meetingId,
    id: item.id,
    sort_order: index,
    question: item.question,
    answer: item.answer,
  }));
}

export function prepFaqsFromDbRows(rows: unknown): PrepFaqItem[] {
  const list = Array.isArray(rows) ? rows : [];
  const sorted = [...list].sort((a, b) => {
    const ao =
      a && typeof a === "object" && typeof (a as { sort_order?: unknown }).sort_order === "number"
        ? (a as { sort_order: number }).sort_order
        : 0;
    const bo =
      b && typeof b === "object" && typeof (b as { sort_order?: unknown }).sort_order === "number"
        ? (b as { sort_order: number }).sort_order
        : 0;
    return ao - bo;
  });
  return normalizePrepFaqs(sorted);
}
