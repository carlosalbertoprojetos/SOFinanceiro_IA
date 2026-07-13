import { Prisma } from "../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import { Money } from "./money";

describe("Money", () => {
  it.each([
    ["0.01", "0.01"],
    ["10.1", "10.10"],
    ["10.10", "10.10"],
    ["99999999999999999.99", "99999999999999999.99"],
  ])("preserves valid decimal %s exactly", (input, expected) => {
    expect(Money.fromString(input, "BRL").toString()).toBe(expected);
  });

  it.each([
    "",
    " ",
    " 10.00",
    "10.00 ",
    "01.00",
    ".50",
    "10.",
    "10.001",
    "1e2",
    "1E2",
    "not-money",
    "100000000000000000.00",
  ])("rejects invalid input %s", (input) => {
    expect(() => Money.fromString(input, "BRL")).toThrow(
      "Invalid monetary amount",
    );
  });

  it.each(["0", "0.00", "-0.01", "-10.00"])(
    "rejects non-positive value %s when positivity is required",
    (input) => {
      expect(() => Money.fromString(input, "BRL").assertPositive()).toThrow(
        "Monetary amount must be positive",
      );
    },
  );

  it("converts Prisma Decimal without losing precision", () => {
    const money = Money.fromPrisma(new Prisma.Decimal("10.10"), "BRL");

    expect(money.toString()).toBe("10.10");
    expect(money.toPrisma().toFixed(2)).toBe("10.10");
  });

  it("compares only values in the same currency", () => {
    const ten = Money.fromString("10.00", "BRL");

    expect(ten.compare(Money.fromString("11.00", "BRL"))).toBe(-1);
    expect(ten.equals(Money.fromString("10", "BRL"))).toBe(true);
    expect(() => ten.compare(Money.fromString("10.00", "USD"))).toThrow();
  });

  it("rejects number input even if TypeScript is bypassed", () => {
    expect(() => Money.fromString(10 as unknown as string, "BRL")).toThrow(
      "Invalid monetary amount",
    );
  });
});
