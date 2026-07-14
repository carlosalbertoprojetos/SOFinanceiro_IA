import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/database/prisma.service";
import {
  IdempotencyConflictError,
  PayableConflictError,
  PayableNotFoundError,
  PayablesValidationError,
} from "../src/payables/payables.errors";
import type { AuthorizedCommandContext } from "../src/payables/payables.types";
import {
  CancelOpenPayable,
  CreatePayable,
  PayPayable,
  ReversePayablePayment,
  UpdateOpenPayable,
} from "../src/payables/payables.use-cases";

describe("payables application", () => {
  let app: INestApplication;
  let cancelPayable: CancelOpenPayable;
  let companyId: string;
  let createPayable: CreatePayable;
  let otherCompanyId: string;
  let ownerContext: AuthorizedCommandContext;
  let payPayable: PayPayable;
  let prisma: PrismaService;
  let reversePayment: ReversePayablePayment;
  let updatePayable: UpdateOpenPayable;
  let userId: string;

  const createInput = (idempotencyKey: string = randomUUID()) => ({
    amount: "100.10",
    competenceDate: "2026-07-01",
    description: "Serviço operacional",
    documentNumber: "NF-123",
    dueDate: "2026-07-31",
    idempotencyKey,
    payeeName: "Fornecedor de teste",
  });

  beforeAll(async () => {
    const { AppModule } = await import("../src/app.module");
    app = await NestFactory.create(AppModule, {
      abortOnError: false,
      logger: false,
    });
    await app.init();
    prisma = app.get(PrismaService);
    cancelPayable = app.get(CancelOpenPayable);
    createPayable = app.get(CreatePayable);
    payPayable = app.get(PayPayable);
    reversePayment = app.get(ReversePayablePayment);
    updatePayable = app.get(UpdateOpenPayable);

    const company = await prisma.company.create({
      data: { name: `Payables ${randomUUID()}` },
    });
    const otherCompany = await prisma.company.create({
      data: { name: `Other ${randomUUID()}` },
    });
    const user = await prisma.user.create({
      data: {
        email: `payables-${randomUUID()}@example.test`,
        name: "Owner payables",
      },
    });
    await prisma.companyMembership.create({
      data: { companyId: company.id, role: "OWNER", userId: user.id },
    });
    companyId = company.id;
    otherCompanyId = otherCompany.id;
    userId = user.id;
    ownerContext = {
      companyId,
      requestId: randomUUID(),
      role: "OWNER",
      userId,
    };
  });

  afterAll(async () => {
    if (!prisma) {
      await app?.close();
      return;
    }
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "test_reject_audit" ON "PayableAuditEvent"',
    );
    await prisma.$executeRawUnsafe(
      "DROP FUNCTION IF EXISTS test_reject_payable_audit()",
    );
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "test_reject_payment" ON "PayablePayment"',
    );
    await prisma.$executeRawUnsafe(
      "DROP FUNCTION IF EXISTS test_reject_payable_payment()",
    );
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "test_reject_idempotency" ON "IdempotencyRecord"',
    );
    await prisma.$executeRawUnsafe(
      "DROP FUNCTION IF EXISTS test_reject_idempotency_record()",
    );
    await prisma.payablePaymentReversal.deleteMany({ where: { companyId } });
    await prisma.payableAuditEvent.deleteMany({ where: { companyId } });
    await prisma.payablePayment.deleteMany({ where: { companyId } });
    await prisma.idempotencyRecord.deleteMany({ where: { companyId } });
    await prisma.payable.deleteMany({ where: { companyId } });
    await prisma.companyMembership.deleteMany({ where: { companyId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.company.deleteMany({
      where: { id: { in: [companyId, otherCompanyId] } },
    });
    await app.close();
  });

  it("creates OPEN payable with company currency and replays idempotently", async () => {
    const input = createInput("create-replay");
    const first = await createPayable.execute(ownerContext, input);
    const replay = await createPayable.execute(ownerContext, input);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      amount: "100.10",
      companyId,
      currencyCode: "BRL",
      status: "OPEN",
      version: 1,
    });
    expect(
      await prisma.payable.count({ where: { companyId, id: first.id } }),
    ).toBe(1);
    expect(
      await prisma.payableAuditEvent.count({
        where: { action: "CREATED", companyId, payableId: first.id },
      }),
    ).toBe(1);
  });

  it("rejects idempotency key reuse with another payload", async () => {
    await createPayable.execute(ownerContext, createInput("create-conflict"));

    await expect(
      createPayable.execute(ownerContext, {
        ...createInput("create-conflict"),
        amount: "101.00",
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("produces one effect for concurrent repetition of the same key", async () => {
    const input = createInput("create-concurrent-replay");
    const [first, second] = await Promise.all([
      createPayable.execute(ownerContext, input),
      createPayable.execute(ownerContext, input),
    ]);

    expect(first).toEqual(second);
    expect(
      await prisma.payable.count({ where: { companyId, id: first.id } }),
    ).toBe(1);
  });

  it("isolates idempotency by actor and company", async () => {
    const secondUser = await prisma.user.create({
      data: {
        email: `second-${randomUUID()}@example.test`,
        name: "Second actor",
      },
    });
    await prisma.companyMembership.createMany({
      data: [
        { companyId, role: "ADMIN", userId: secondUser.id },
        { companyId: otherCompanyId, role: "ADMIN", userId: secondUser.id },
      ],
    });
    const input = createInput("same-scoped-key");
    const first = await createPayable.execute(ownerContext, input);
    const second = await createPayable.execute(
      { ...ownerContext, role: "ADMIN", userId: secondUser.id },
      input,
    );
    const third = await createPayable.execute(
      {
        ...ownerContext,
        companyId: otherCompanyId,
        role: "ADMIN",
        userId: secondUser.id,
      },
      input,
    );

    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
    await prisma.payableAuditEvent.deleteMany({
      where: { actorUserId: secondUser.id },
    });
    await prisma.idempotencyRecord.deleteMany({
      where: { actorUserId: secondUser.id },
    });
    await prisma.payable.deleteMany({
      where: { createdByUserId: secondUser.id },
    });
    await prisma.companyMembership.deleteMany({
      where: { userId: secondUser.id },
    });
    await prisma.user.delete({ where: { id: secondUser.id } });
  });

  it("permits one of two optimistic edits", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("edit-race"),
    );
    const results = await Promise.allSettled([
      updatePayable.execute(ownerContext, {
        description: "Edição A",
        expectedVersion: payable.version,
        payableId: payable.id,
      }),
      updatePayable.execute(ownerContext, {
        description: "Edição B",
        expectedVersion: payable.version,
        payableId: payable.id,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: expect.any(PayableConflictError) });
  });

  it("pays integrally once, copies value and blocks editing or cancellation", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("pay-flow"),
    );
    const input = {
      idempotencyKey: "pay-replay",
      paidOn: "2026-07-13",
      payableId: payable.id,
    };
    const paid = await payPayable.execute(ownerContext, input);
    const replay = await payPayable.execute(ownerContext, input);

    expect(paid).toEqual(replay);
    expect(paid.payable.status).toBe("PAID");
    expect(paid.payment).toMatchObject({
      amount: "100.10",
      currencyCode: "BRL",
    });
    await expect(
      updatePayable.execute(ownerContext, {
        description: "Não permitido",
        expectedVersion: paid.payable.version,
        payableId: payable.id,
      }),
    ).rejects.toBeInstanceOf(PayableConflictError);
    await expect(
      cancelPayable.execute(ownerContext, {
        expectedVersion: paid.payable.version,
        payableId: payable.id,
        reason: "Não permitido",
      }),
    ).rejects.toBeInstanceOf(PayableConflictError);
  });

  it("allows only one concurrent payment effect", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("payment-race-create"),
    );
    const results = await Promise.allSettled([
      payPayable.execute(ownerContext, {
        idempotencyKey: "payment-race-a",
        paidOn: "2026-07-13",
        payableId: payable.id,
      }),
      payPayable.execute(ownerContext, {
        idempotencyKey: "payment-race-b",
        paidOn: "2026-07-13",
        payableId: payable.id,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await prisma.payablePayment.count({
        where: { companyId, payableId: payable.id },
      }),
    ).toBe(1);
  });

  it("keeps payment and cancellation concurrent transition coherent", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("payment-cancellation-race-create"),
    );
    const results = await Promise.allSettled([
      payPayable.execute(ownerContext, {
        idempotencyKey: "payment-cancellation-race-pay",
        paidOn: "2026-07-13",
        payableId: payable.id,
      }),
      cancelPayable.execute(ownerContext, {
        expectedVersion: payable.version,
        payableId: payable.id,
        reason: "Cancelamento concorrente",
      }),
    ]);
    const persisted = await prisma.payable.findFirstOrThrow({
      where: { companyId, id: payable.id },
    });
    const payments = await prisma.payablePayment.count({
      where: { companyId, payableId: payable.id },
    });

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(["PAID", "CANCELED"]).toContain(persisted.status);
    expect(payments).toBe(persisted.status === "PAID" ? 1 : 0);
  });

  it("reverses without deleting payment and permits one concurrent reversal", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("reverse-race-create"),
    );
    const paid = await payPayable.execute(ownerContext, {
      idempotencyKey: "reverse-race-pay",
      paidOn: "2026-07-13",
      payableId: payable.id,
    });
    const results = await Promise.allSettled([
      reversePayment.execute(ownerContext, {
        idempotencyKey: "reverse-race-a",
        payableId: payable.id,
        paymentId: paid.payment.id,
        reason: "Correção A",
      }),
      reversePayment.execute(ownerContext, {
        idempotencyKey: "reverse-race-b",
        payableId: payable.id,
        paymentId: paid.payment.id,
        reason: "Correção B",
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await prisma.payablePayment.count({ where: { id: paid.payment.id } }),
    ).toBe(1);
    expect(
      await prisma.payablePaymentReversal.count({
        where: { companyId, paymentId: paid.payment.id },
      }),
    ).toBe(1);
    expect(
      await prisma.payable.findFirst({
        select: { status: true },
        where: { companyId, id: payable.id },
      }),
    ).toEqual({ status: "OPEN" });
  });

  it("replays a reversal idempotently without duplicating it", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("reverse-replay-create"),
    );
    const paid = await payPayable.execute(ownerContext, {
      idempotencyKey: "reverse-replay-pay",
      paidOn: "2026-07-13",
      payableId: payable.id,
    });
    const command = {
      idempotencyKey: "reverse-replay",
      payableId: payable.id,
      paymentId: paid.payment.id,
      reason: "Correção idempotente",
    };

    const first = await reversePayment.execute(ownerContext, command);
    const replay = await reversePayment.execute(ownerContext, command);

    expect(replay).toEqual(first);
    expect(
      await prisma.payablePaymentReversal.count({
        where: { companyId, paymentId: paid.payment.id },
      }),
    ).toBe(1);
  });

  it("cancels OPEN non-destructively and treats same retry as no-op", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("cancel-flow"),
    );
    const canceled = await cancelPayable.execute(ownerContext, {
      expectedVersion: payable.version,
      payableId: payable.id,
      reason: "Duplicidade operacional",
    });
    const replay = await cancelPayable.execute(ownerContext, {
      expectedVersion: payable.version,
      payableId: payable.id,
      reason: "Duplicidade operacional",
    });

    expect(canceled.status).toBe("CANCELED");
    expect(replay).toEqual(canceled);
    expect(
      await prisma.payableAuditEvent.count({
        where: { action: "CANCELED", companyId, payableId: payable.id },
      }),
    ).toBe(1);
    await expect(
      updatePayable.execute(ownerContext, {
        description: "Terminal",
        expectedVersion: canceled.version,
        payableId: payable.id,
      }),
    ).rejects.toBeInstanceOf(PayableConflictError);
  });

  it("does not reveal or mutate another tenant resource", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("tenant-isolation"),
    );
    await expect(
      updatePayable.execute(
        { ...ownerContext, companyId: otherCompanyId },
        {
          description: "Cross tenant",
          expectedVersion: payable.version,
          payableId: payable.id,
        },
      ),
    ).rejects.toBeInstanceOf(PayableNotFoundError);
  });

  it("rejects MEMBER mutations inside the use case", async () => {
    await expect(
      createPayable.execute(
        { ...ownerContext, role: "MEMBER" },
        createInput("member-rejected"),
      ),
    ).rejects.toBeInstanceOf(PayablesValidationError);
  });

  it("rolls back mutation when audit insertion fails", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("audit-rollback-create"),
    );
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_reject_payable_audit() RETURNS trigger AS $$
      BEGIN
        IF NEW."requestId" = 'force-audit-failure' THEN
          RAISE EXCEPTION 'forced audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "test_reject_audit"
      BEFORE INSERT ON "PayableAuditEvent"
      FOR EACH ROW EXECUTE FUNCTION test_reject_payable_audit();
    `);

    await expect(
      payPayable.execute(
        { ...ownerContext, requestId: "force-audit-failure" },
        {
          idempotencyKey: "audit-rollback-pay",
          paidOn: "2026-07-13",
          payableId: payable.id,
        },
      ),
    ).rejects.toThrow();
    expect(
      await prisma.payable.findFirst({
        select: { status: true, version: true },
        where: { companyId, id: payable.id },
      }),
    ).toEqual({ status: "OPEN", version: 1 });
    expect(
      await prisma.payablePayment.count({ where: { payableId: payable.id } }),
    ).toBe(0);

    await prisma.$executeRawUnsafe(
      'DROP TRIGGER "test_reject_audit" ON "PayableAuditEvent"',
    );
    await prisma.$executeRawUnsafe("DROP FUNCTION test_reject_payable_audit()");
  });

  it("rolls back transition when payment insertion fails", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("payment-rollback-create"),
    );
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_reject_payable_payment() RETURNS trigger AS $$
      BEGIN
        IF NEW."payableId" = '${payable.id}' THEN
          RAISE EXCEPTION 'forced payment failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "test_reject_payment"
      BEFORE INSERT ON "PayablePayment"
      FOR EACH ROW EXECUTE FUNCTION test_reject_payable_payment();
    `);

    await expect(
      payPayable.execute(ownerContext, {
        idempotencyKey: "payment-rollback-pay",
        paidOn: "2026-07-13",
        payableId: payable.id,
      }),
    ).rejects.toThrow();
    expect(
      await prisma.payable.findFirst({
        select: { status: true, version: true },
        where: { companyId, id: payable.id },
      }),
    ).toEqual({ status: "OPEN", version: 1 });
    expect(
      await prisma.payableAuditEvent.count({
        where: { action: "PAID", companyId, payableId: payable.id },
      }),
    ).toBe(0);

    await prisma.$executeRawUnsafe(
      'DROP TRIGGER "test_reject_payment" ON "PayablePayment"',
    );
    await prisma.$executeRawUnsafe(
      "DROP FUNCTION test_reject_payable_payment()",
    );
  });

  it("rolls back creation when idempotency persistence fails", async () => {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_reject_idempotency_record() RETURNS trigger AS $$
      BEGIN
        IF NEW."idempotencyKey" = 'force-idempotency-failure' THEN
          RAISE EXCEPTION 'forced idempotency failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER "test_reject_idempotency"
      BEFORE INSERT ON "IdempotencyRecord"
      FOR EACH ROW EXECUTE FUNCTION test_reject_idempotency_record();
    `);
    const before = await prisma.payable.count({ where: { companyId } });

    await expect(
      createPayable.execute(
        ownerContext,
        createInput("force-idempotency-failure"),
      ),
    ).rejects.toThrow();
    expect(await prisma.payable.count({ where: { companyId } })).toBe(before);

    await prisma.$executeRawUnsafe(
      'DROP TRIGGER "test_reject_idempotency" ON "IdempotencyRecord"',
    );
    await prisma.$executeRawUnsafe(
      "DROP FUNCTION test_reject_idempotency_record()",
    );
  });

  it("rejects future payment using company timezone", async () => {
    const payable = await createPayable.execute(
      ownerContext,
      createInput("future-payment"),
    );
    await expect(
      payPayable.execute(ownerContext, {
        idempotencyKey: "future-payment-attempt",
        paidOn: "2999-01-01",
        payableId: payable.id,
      }),
    ).rejects.toThrow("Payment date cannot be in the future");
  });
});
