import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorMessageFromApiBody, formatUnknownError } from "./api-error";

describe("api-error", () => {
  it("lee error string del cuerpo", () => {
    assert.equal(errorMessageFromApiBody({ error: "falló" }, "x"), "falló");
  });

  it("lee error anidado con message", () => {
    assert.equal(
      errorMessageFromApiBody({ error: { message: "Tavus 402" } }, "x"),
      "Tavus 402",
    );
  });

  it("formatea objetos con message", () => {
    assert.equal(formatUnknownError({ message: "join failed" }, "x"), "join failed");
  });

  it("lee errorMsg de Daily", () => {
    assert.equal(
      formatUnknownError({ errorMsg: "room full" }, "x"),
      "room full",
    );
  });
});
