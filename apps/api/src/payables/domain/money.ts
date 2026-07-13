import { Prisma } from "../../generated/prisma/client";
import { PayablesDomainError } from "../payables.errors";

const AMOUNT_PATTERN = /^-?(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class Money {
  private constructor(
    private readonly decimal: Prisma.Decimal,
    readonly currencyCode: string,
  ) {}

  static fromString(amount: string, currencyCode: string): Money {
    if (
      typeof amount !== "string" ||
      !AMOUNT_PATTERN.test(amount) ||
      amount.includes("e") ||
      amount.includes("E")
    ) {
      throw new PayablesDomainError("Invalid monetary amount");
    }
    if (!CURRENCY_PATTERN.test(currencyCode)) {
      throw new PayablesDomainError("Invalid currency code");
    }

    return new Money(new Prisma.Decimal(amount), currencyCode);
  }

  static fromPrisma(amount: Prisma.Decimal, currencyCode: string): Money {
    return Money.fromString(amount.toFixed(2), currencyCode);
  }

  assertPositive(): Money {
    if (!this.decimal.isPositive() || this.decimal.isZero()) {
      throw new PayablesDomainError("Monetary amount must be positive");
    }
    return this;
  }

  equals(other: Money): boolean {
    return (
      this.currencyCode === other.currencyCode &&
      this.decimal.equals(other.decimal)
    );
  }

  compare(other: Money): -1 | 0 | 1 {
    if (this.currencyCode !== other.currencyCode) {
      throw new PayablesDomainError("Cannot compare different currencies");
    }
    return this.decimal.comparedTo(other.decimal) as -1 | 0 | 1;
  }

  toPrisma(): Prisma.Decimal {
    return new Prisma.Decimal(this.decimal);
  }

  toString(): string {
    return this.decimal.toFixed(2);
  }
}
