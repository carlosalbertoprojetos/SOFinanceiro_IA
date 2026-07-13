import { describe, expect, it } from "vitest";

import {
  assertNotFutureCivilDate,
  parseCivilDate,
  serializeCivilDate,
  todayInTimeZone,
} from "./civil-date";

describe("civil dates", () => {
  it("preserves a valid DATE boundary", () => {
    expect(serializeCivilDate(parseCivilDate("2026-07-13"))).toBe("2026-07-13");
  });

  it.each(["2026-02-30", "2026-2-03", "13/07/2026", ""])(
    "rejects invalid civil date %s",
    (value) =>
      expect(() => parseCivilDate(value)).toThrow("Invalid civil date"),
  );

  it("uses company timezone to determine today", () => {
    const now = new Date("2026-07-14T01:00:00.000Z");

    expect(todayInTimeZone("America/Sao_Paulo", now)).toBe("2026-07-13");
    expect(todayInTimeZone("UTC", now)).toBe("2026-07-14");
  });

  it("allows early payment and rejects future local date", () => {
    const now = new Date("2026-07-14T01:00:00.000Z");

    expect(() =>
      assertNotFutureCivilDate("2026-07-12", "America/Sao_Paulo", now),
    ).not.toThrow();
    expect(() =>
      assertNotFutureCivilDate("2026-07-14", "America/Sao_Paulo", now),
    ).toThrow("Payment date cannot be in the future");
  });
});
