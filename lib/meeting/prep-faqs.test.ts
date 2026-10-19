import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addPrepFaq,
  normalizePrepFaqs,
  prepFaqDbRows,
  prepFaqsForDisplay,
  prepFaqsFromDbRows,
  prepFaqsFromPutBody,
  prepFaqsStorageKey,
  readStoredPrepFaqs,
  removePrepFaq,
  updatePrepFaq,
  writeStoredPrepFaqs,
} from "./prep-faqs";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length() {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe("prep-faqs", () => {
  it("add, edit, remove keeps two items after three adds and one delete", () => {
    let items: ReturnType<typeof addPrepFaq> = [];
    items = addPrepFaq(items, "a");
    items = addPrepFaq(items, "b");
    items = addPrepFaq(items, "c");
    items = updatePrepFaq(items, "b", { question: "Q2", answer: "A2" });
    items = removePrepFaq(items, "a");
    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((r) => r.id).sort(),
      ["b", "c"],
    );
    assert.equal(items.find((r) => r.id === "b")?.question, "Q2");
  });

  it("isolates storage by meetingId", () => {
    const store = new MemoryStorage();
    writeStoredPrepFaqs("meet-a", [{ id: "1", question: "A", answer: "" }], store);
    writeStoredPrepFaqs("meet-b", [{ id: "2", question: "B", answer: "" }], store);
    assert.equal(readStoredPrepFaqs("meet-a", store).length, 1);
    assert.equal(readStoredPrepFaqs("meet-b", store)[0]?.question, "B");
    assert.equal(prepFaqsStorageKey("meet-a"), "catch:meet-a:prepFaqs");
  });

  it("shows empty display list when all rows are blank", () => {
    const items = [{ id: "x", question: "  ", answer: "" }];
    assert.equal(prepFaqsForDisplay(items).length, 0);
    assert.equal(
      prepFaqsForDisplay([{ id: "y", question: "Hola", answer: "" }]).length,
      1,
    );
  });

  it("normalizes monitor shape pregunta/respuesta", () => {
    const items = normalizePrepFaqs([
      { id: "1", pregunta: "P", respuesta: "R" },
    ]);
    assert.equal(items[0]?.question, "P");
    assert.equal(items[0]?.answer, "R");
  });

  it("preserves items across simulated slide navigation (same storage read)", () => {
    const store = new MemoryStorage();
    const meetingId = "slide-test";
    const faqs = [{ id: "1", question: "Q", answer: "A" }];
    writeStoredPrepFaqs(meetingId, faqs, store);
    const afterSlide = readStoredPrepFaqs(meetingId, store);
    assert.deepEqual(afterSlide, faqs);
  });

  it("maps PUT body and DB rows without mixing meeting ids", () => {
    const items = prepFaqsFromPutBody("meet-a", {
      faqs: [{ id: "1", pregunta: "Pa", respuesta: "Ra" }],
    });
    const rowsA = prepFaqDbRows("meet-a", items);
    const rowsB = prepFaqDbRows("meet-b", [{ id: "9", question: "Pb", answer: "Rb" }]);
    assert.equal(prepFaqsFromDbRows(rowsA)[0]?.question, "Pa");
    assert.equal(rowsA[0]?.meeting_id, "meet-a");
    assert.equal(rowsB[0]?.meeting_id, "meet-b");
    assert.equal(
      prepFaqsFromDbRows([...rowsA, ...rowsB]).filter((r) => r.id === "1").length,
      1,
    );
  });
});
