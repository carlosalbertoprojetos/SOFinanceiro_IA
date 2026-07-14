import { describe, expect, it } from "vitest";

import { safeReturnTo } from "./safe-return-to";

describe("safeReturnTo", () => {
  it("preserves a local application route", () => {
    expect(safeReturnTo("/companies/123/payables?status=OPEN")).toBe(
      "/companies/123/payables?status=OPEN",
    );
  });

  it.each([
    "https://attacker.example/",
    "//attacker.example/",
    "javascript:alert(1)",
    undefined,
  ])("blocks an unsafe return URL", (value) => {
    expect(safeReturnTo(value)).toBe("/companies");
  });
});
