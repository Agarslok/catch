import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRESENTER_ACCESS_PASSWORD,
  PRESENTER_ACCESS_STORAGE_KEY,
  grantPresenterAccess,
  isPresenterAccessGranted,
  verifyPresenterAccessPassword,
} from "./demo-access-gate";

function withSessionStorage(run: () => void) {
  const bag = new Map<string, string>();
  const stub = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => {
      bag.set(k, v);
    },
    removeItem: (k: string) => {
      bag.delete(k);
    },
  };
  const prev = globalThis.sessionStorage;
  Object.defineProperty(globalThis, "sessionStorage", {
    value: stub,
    configurable: true,
  });
  try {
    run();
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", {
      value: prev,
      configurable: true,
    });
  }
}

describe("demo-access-gate", () => {
  it("acepta solo la contraseña demo exacta", () => {
    assert.equal(verifyPresenterAccessPassword(PRESENTER_ACCESS_PASSWORD), true);
    assert.equal(verifyPresenterAccessPassword(" 12345 "), true);
    assert.equal(verifyPresenterAccessPassword("12346"), false);
    assert.equal(verifyPresenterAccessPassword(""), false);
  });

  it("persiste el acceso en sessionStorage", () => {
    withSessionStorage(() => {
      assert.equal(isPresenterAccessGranted(), false);
      grantPresenterAccess();
      assert.equal(isPresenterAccessGranted(), true);
      assert.equal(
        globalThis.sessionStorage.getItem(PRESENTER_ACCESS_STORAGE_KEY),
        "1",
      );
    });
  });
});
