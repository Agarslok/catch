import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rpcFunctionMissing } from "./reset-session";

describe("reset session rpc detection", () => {
  it("reconoce que la función SQL todavía no está en Supabase", () => {
    assert.equal(rpcFunctionMissing({ code: "PGRST202", message: "not found" }), true);
    assert.equal(
      rpcFunctionMissing({
        message: "Could not find the function public.reset_meeting_session",
      }),
      true,
    );
  });

  it("no trata un error de escritura como función ausente", () => {
    assert.equal(rpcFunctionMissing({ code: "42501", message: "permission denied" }), false);
  });
});
