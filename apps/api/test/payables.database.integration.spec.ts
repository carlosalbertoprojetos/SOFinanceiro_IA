import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://sofia:sofia_local@127.0.0.1:5433/sofia?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

describe("payables database constraints", () => {
  let companyId: string;
  let otherCompanyId: string;
  let otherUserId: string;
  let payableId: string;
  let paymentId: string;
  let userId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const company = await prisma.company.create({
      data: { name: `Constraint company ${randomUUID()}` },
    });
    const otherCompany = await prisma.company.create({
      data: { name: `Constraint other ${randomUUID()}` },
    });
    const user = await prisma.user.create({
      data: {
        email: `constraint-${randomUUID()}@example.test`,
        name: "Constraint user",
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        email: `constraint-other-${randomUUID()}@example.test`,
        name: "Constraint other user",
      },
    });
    await prisma.companyMembership.createMany({
      data: [
        { companyId: company.id, role: "OWNER", userId: user.id },
        {
          companyId: otherCompany.id,
          role: "OWNER",
          userId: otherUser.id,
        },
      ],
    });
    const payable = await prisma.payable.create({
      data: {
        amount: new Prisma.Decimal("10.10"),
        companyId: company.id,
        competenceDate: new Date("2026-07-01T00:00:00.000Z"),
        createdByUserId: user.id,
        currencyCode: "BRL",
        description: "Constraint payable",
        dueDate: new Date("2026-07-31T00:00:00.000Z"),
        payeeName: "Constraint payee",
        updatedByUserId: user.id,
      },
    });
    const payment = await prisma.payablePayment.create({
      data: {
        amount: payable.amount,
        companyId: company.id,
        currencyCode: payable.currencyCode,
        paidOn: new Date("2026-07-13T00:00:00.000Z"),
        payableId: payable.id,
        recordedByUserId: user.id,
      },
    });
    companyId = company.id;
    otherCompanyId = otherCompany.id;
    otherUserId = otherUser.id;
    payableId = payable.id;
    paymentId = payment.id;
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.payablePaymentReversal.deleteMany({ where: { companyId } });
    await prisma.payablePayment.deleteMany({ where: { companyId } });
    await prisma.payable.deleteMany({ where: { companyId } });
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: [companyId, otherCompanyId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userId, otherUserId] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyId, otherCompanyId] } },
    });
    await prisma.$disconnect();
  });

  it("rejects zero amount", async () => {
    await expect(
      prisma.payable.create({
        data: {
          amount: new Prisma.Decimal("0.00"),
          companyId,
          competenceDate: new Date("2026-07-01T00:00:00.000Z"),
          createdByUserId: userId,
          currencyCode: "BRL",
          description: "Invalid zero",
          dueDate: new Date("2026-07-31T00:00:00.000Z"),
          payeeName: "Invalid",
          updatedByUserId: userId,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects actor without membership in the payable company", async () => {
    await expect(
      prisma.payable.create({
        data: {
          amount: new Prisma.Decimal("1.00"),
          companyId,
          competenceDate: new Date("2026-07-01T00:00:00.000Z"),
          createdByUserId: otherUserId,
          currencyCode: "BRL",
          description: "Cross actor",
          dueDate: new Date("2026-07-31T00:00:00.000Z"),
          payeeName: "Invalid",
          updatedByUserId: otherUserId,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects payment linked across companies", async () => {
    await expect(
      prisma.payablePayment.create({
        data: {
          amount: new Prisma.Decimal("10.10"),
          companyId: otherCompanyId,
          currencyCode: "BRL",
          paidOn: new Date("2026-07-13T00:00:00.000Z"),
          payableId,
          recordedByUserId: otherUserId,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects reversal linked across companies", async () => {
    await expect(
      prisma.payablePaymentReversal.create({
        data: {
          companyId: otherCompanyId,
          paymentId,
          reason: "Cross tenant",
          reversedByUserId: otherUserId,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects audit linked across companies", async () => {
    await expect(
      prisma.payableAuditEvent.create({
        data: {
          action: "CREATED",
          actorUserId: otherUserId,
          changes: {},
          companyId: otherCompanyId,
          newVersion: 1,
          payableId,
          requestId: randomUUID(),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects incoherent cancellation metadata", async () => {
    await expect(
      prisma.payable.update({
        data: { status: "CANCELED" },
        where: { id: payableId },
      }),
    ).rejects.toThrow();
  });

  it("allows at most one reversal per payment", async () => {
    await prisma.payablePaymentReversal.create({
      data: {
        companyId,
        paymentId,
        reason: "Primeiro estorno",
        reversedByUserId: userId,
      },
    });

    await expect(
      prisma.payablePaymentReversal.create({
        data: {
          companyId,
          paymentId,
          reason: "Segundo estorno",
          reversedByUserId: userId,
        },
      }),
    ).rejects.toThrow();
  });

  it("preserves civil DATE without timezone shift", async () => {
    const payable = await prisma.payable.findFirstOrThrow({
      where: { companyId, id: payableId },
    });

    expect(payable.competenceDate.toISOString().slice(0, 10)).toBe(
      "2026-07-01",
    );
    expect(payable.dueDate.toISOString().slice(0, 10)).toBe("2026-07-31");
  });
});
