import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { PrismaService } from "../database/prisma.service";
import { assertNotFutureCivilDate, parseCivilDate } from "./domain/civil-date";
import { Money } from "./domain/money";
import {
  IdempotencyConflictError,
  PayableConflictError,
  PayableNotFoundError,
  PayablesValidationError,
} from "./payables.errors";
import {
  assertMutationContext,
  optionalText,
  requiredText,
  serializePayable,
  serializePayment,
  serializeReversal,
} from "./payables.helpers";
import type {
  AuthorizedCommandContext,
  PayableView,
  PaymentView,
  ReversalView,
} from "./payables.types";

type CreatePayableInput = {
  amount: string;
  competenceDate: string;
  description: string;
  documentNumber?: string | null;
  dueDate: string;
  idempotencyKey: string;
  payeeName: string;
};

type UpdatePayableInput = {
  amount?: string;
  competenceDate?: string;
  description?: string;
  documentNumber?: string | null;
  dueDate?: string;
  expectedVersion: number;
  payeeName?: string;
  payableId: string;
};

type PayPayableInput = {
  idempotencyKey: string;
  paidOn: string;
  payableId: string;
};

type ReversePaymentInput = {
  idempotencyKey: string;
  payableId: string;
  paymentId: string;
  reason: string;
};

type CancelPayableInput = {
  expectedVersion: number;
  payableId: string;
  reason: string;
};

type PaymentResult = { payable: PayableView; payment: PaymentView };
type ReversalResult = { payable: PayableView; reversal: ReversalView };

function assertExpectedVersion(version: number): void {
  if (!Number.isInteger(version) || version < 1) {
    throw new PayablesValidationError("Invalid expectedVersion");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

@Injectable()
export class CreatePayable {
  constructor(private readonly idempotency: IdempotencyService) {}

  async execute(
    context: AuthorizedCommandContext,
    input: CreatePayableInput,
  ): Promise<PayableView> {
    assertMutationContext(context);
    const payeeName = requiredText(input.payeeName, 160, "payeeName");
    const description = requiredText(input.description, 500, "description");
    const documentNumber = optionalText(
      input.documentNumber,
      100,
      "documentNumber",
    );
    const amount = Money.fromString(input.amount, "BRL")
      .assertPositive()
      .toString();
    parseCivilDate(input.competenceDate);
    parseCivilDate(input.dueDate);

    const result = await this.idempotency.execute({
      actorUserId: context.userId,
      companyId: context.companyId,
      idempotencyKey: input.idempotencyKey,
      operation: "CREATE_PAYABLE",
      payload: {
        amount,
        competenceDate: input.competenceDate,
        description,
        documentNumber: documentNumber ?? null,
        dueDate: input.dueDate,
        payeeName,
      },
      run: async (transaction) => {
        const company = await transaction.company.findUnique({
          select: { currencyCode: true },
          where: { id: context.companyId },
        });
        if (!company) {
          throw new PayableNotFoundError("Resource not found");
        }
        const money = Money.fromString(
          amount,
          company.currencyCode,
        ).assertPositive();
        const payable = await transaction.payable.create({
          data: {
            amount: money.toPrisma(),
            companyId: context.companyId,
            competenceDate: parseCivilDate(input.competenceDate),
            createdByUserId: context.userId,
            currencyCode: company.currencyCode,
            description,
            documentNumber: documentNumber ?? null,
            dueDate: parseCivilDate(input.dueDate),
            payeeName,
            updatedByUserId: context.userId,
          },
        });
        const response = serializePayable(payable);
        await transaction.payableAuditEvent.create({
          data: {
            action: "CREATED",
            actorUserId: context.userId,
            changes: {
              amount: response.amount,
              competenceDate: response.competenceDate,
              currencyCode: response.currencyCode,
              description: response.description,
              documentNumber: response.documentNumber,
              dueDate: response.dueDate,
              payeeName: response.payeeName,
              status: response.status,
            },
            companyId: context.companyId,
            newVersion: payable.version,
            payableId: payable.id,
            requestId: context.requestId,
          },
        });
        return {
          httpStatus: 201,
          resourceId: payable.id,
          resourceType: "Payable",
          response,
        };
      },
    });
    return result.response;
  }
}

@Injectable()
export class UpdateOpenPayable {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    context: AuthorizedCommandContext,
    input: UpdatePayableInput,
  ): Promise<PayableView> {
    assertMutationContext(context);
    assertExpectedVersion(input.expectedVersion);
    const hasChange = [
      input.amount,
      input.competenceDate,
      input.description,
      input.documentNumber,
      input.dueDate,
      input.payeeName,
    ].some((value) => value !== undefined);
    if (!hasChange) {
      throw new PayablesValidationError("At least one field must be changed");
    }

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.payable.findFirst({
        where: { companyId: context.companyId, id: input.payableId },
      });
      if (!current) {
        throw new PayableNotFoundError("Resource not found");
      }
      if (current.status !== "OPEN") {
        throw new PayableConflictError("Only OPEN payables can be edited");
      }
      if (current.version !== input.expectedVersion) {
        throw new PayableConflictError("Payable version conflict");
      }

      const data: Prisma.PayableUncheckedUpdateManyInput = {
        updatedByUserId: context.userId,
        version: { increment: 1 },
      };
      const changes: Record<string, unknown> = {};
      if (input.payeeName !== undefined) {
        data.payeeName = requiredText(input.payeeName, 160, "payeeName");
        changes.payeeName = { from: current.payeeName, to: data.payeeName };
      }
      if (input.description !== undefined) {
        data.description = requiredText(input.description, 500, "description");
        changes.description = {
          from: current.description,
          to: data.description,
        };
      }
      if (input.documentNumber !== undefined) {
        data.documentNumber =
          optionalText(input.documentNumber, 100, "documentNumber") ?? null;
        changes.documentNumber = {
          from: current.documentNumber,
          to: data.documentNumber,
        };
      }
      if (input.amount !== undefined) {
        const money = Money.fromString(
          input.amount,
          current.currencyCode,
        ).assertPositive();
        data.amount = money.toPrisma();
        changes.amount = {
          from: Money.fromPrisma(
            current.amount,
            current.currencyCode,
          ).toString(),
          to: money.toString(),
        };
      }
      if (input.competenceDate !== undefined) {
        data.competenceDate = parseCivilDate(input.competenceDate);
        changes.competenceDate = input.competenceDate;
      }
      if (input.dueDate !== undefined) {
        data.dueDate = parseCivilDate(input.dueDate);
        changes.dueDate = input.dueDate;
      }

      const updated = await transaction.payable.updateMany({
        data,
        where: {
          companyId: context.companyId,
          id: input.payableId,
          status: "OPEN",
          version: input.expectedVersion,
        },
      });
      if (updated.count !== 1) {
        throw new PayableConflictError("Payable version conflict");
      }
      const payable = await transaction.payable.findFirstOrThrow({
        where: { companyId: context.companyId, id: input.payableId },
      });
      await transaction.payableAuditEvent.create({
        data: {
          action: "UPDATED",
          actorUserId: context.userId,
          changes: changes as Prisma.InputJsonValue,
          companyId: context.companyId,
          newVersion: payable.version,
          payableId: payable.id,
          previousVersion: current.version,
          requestId: context.requestId,
        },
      });
      return serializePayable(payable);
    });
  }
}

@Injectable()
export class PayPayable {
  constructor(private readonly idempotency: IdempotencyService) {}

  async execute(
    context: AuthorizedCommandContext,
    input: PayPayableInput,
  ): Promise<PaymentResult> {
    assertMutationContext(context);
    parseCivilDate(input.paidOn);

    const result = await this.idempotency.execute({
      actorUserId: context.userId,
      companyId: context.companyId,
      idempotencyKey: input.idempotencyKey,
      operation: "PAY_PAYABLE",
      payload: { paidOn: input.paidOn, payableId: input.payableId },
      run: async (transaction) => {
        const company = await transaction.company.findUnique({
          select: { timezone: true },
          where: { id: context.companyId },
        });
        const current = await transaction.payable.findFirst({
          where: { companyId: context.companyId, id: input.payableId },
        });
        if (!company || !current) {
          throw new PayableNotFoundError("Resource not found");
        }
        assertNotFutureCivilDate(input.paidOn, company.timezone);
        if (current.status !== "OPEN") {
          throw new PayableConflictError("Only OPEN payables can be paid");
        }

        const transitioned = await transaction.payable.updateMany({
          data: {
            status: "PAID",
            updatedByUserId: context.userId,
            version: { increment: 1 },
          },
          where: {
            companyId: context.companyId,
            id: current.id,
            status: "OPEN",
            version: current.version,
          },
        });
        if (transitioned.count !== 1) {
          throw new PayableConflictError("Payable transition conflict");
        }
        const payment = await transaction.payablePayment.create({
          data: {
            amount: current.amount,
            companyId: context.companyId,
            currencyCode: current.currencyCode,
            paidOn: parseCivilDate(input.paidOn),
            payableId: current.id,
            recordedByUserId: context.userId,
          },
        });
        const payable = await transaction.payable.findFirstOrThrow({
          where: { companyId: context.companyId, id: current.id },
        });
        await transaction.payableAuditEvent.create({
          data: {
            action: "PAID",
            actorUserId: context.userId,
            changes: {
              amount: Money.fromPrisma(
                current.amount,
                current.currencyCode,
              ).toString(),
              currencyCode: current.currencyCode,
              status: { from: "OPEN", to: "PAID" },
            },
            companyId: context.companyId,
            newVersion: payable.version,
            payableId: payable.id,
            previousVersion: current.version,
            requestId: context.requestId,
          },
        });
        const response = {
          payable: serializePayable(payable),
          payment: serializePayment(payment),
        };
        return {
          httpStatus: 201,
          resourceId: payment.id,
          resourceType: "PayablePayment",
          response,
        };
      },
    });
    return result.response;
  }
}

@Injectable()
export class ReversePayablePayment {
  constructor(private readonly idempotency: IdempotencyService) {}

  async execute(
    context: AuthorizedCommandContext,
    input: ReversePaymentInput,
  ): Promise<ReversalResult> {
    assertMutationContext(context);
    const reason = requiredText(input.reason, 500, "reason");

    const result = await this.idempotency.execute({
      actorUserId: context.userId,
      companyId: context.companyId,
      idempotencyKey: input.idempotencyKey,
      operation: "REVERSE_PAYABLE_PAYMENT",
      payload: {
        payableId: input.payableId,
        paymentId: input.paymentId,
        reason,
      },
      run: async (transaction) => {
        const payment = await transaction.payablePayment.findFirst({
          include: { payable: true, reversal: true },
          where: {
            companyId: context.companyId,
            id: input.paymentId,
            payableId: input.payableId,
          },
        });
        if (!payment) {
          throw new PayableNotFoundError("Resource not found");
        }
        if (payment.reversal || payment.payable.status !== "PAID") {
          throw new PayableConflictError("Payment is not active");
        }

        const transitioned = await transaction.payable.updateMany({
          data: {
            status: "OPEN",
            updatedByUserId: context.userId,
            version: { increment: 1 },
          },
          where: {
            companyId: context.companyId,
            id: payment.payableId,
            status: "PAID",
            version: payment.payable.version,
          },
        });
        if (transitioned.count !== 1) {
          throw new PayableConflictError("Payable transition conflict");
        }

        let reversal;
        try {
          reversal = await transaction.payablePaymentReversal.create({
            data: {
              companyId: context.companyId,
              paymentId: payment.id,
              reason,
              reversedByUserId: context.userId,
            },
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new PayableConflictError("Payment is already reversed");
          }
          throw error;
        }
        const payable = await transaction.payable.findFirstOrThrow({
          where: { companyId: context.companyId, id: payment.payableId },
        });
        await transaction.payableAuditEvent.create({
          data: {
            action: "PAYMENT_REVERSED",
            actorUserId: context.userId,
            changes: { status: { from: "PAID", to: "OPEN" } },
            companyId: context.companyId,
            newVersion: payable.version,
            payableId: payable.id,
            previousVersion: payment.payable.version,
            reason,
            requestId: context.requestId,
          },
        });
        const response = {
          payable: serializePayable(payable),
          reversal: serializeReversal(reversal),
        };
        return {
          httpStatus: 201,
          resourceId: reversal.id,
          resourceType: "PayablePaymentReversal",
          response,
        };
      },
    });
    return result.response;
  }
}

@Injectable()
export class CancelOpenPayable {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    context: AuthorizedCommandContext,
    input: CancelPayableInput,
  ): Promise<PayableView> {
    assertMutationContext(context);
    assertExpectedVersion(input.expectedVersion);
    const reason = requiredText(input.reason, 500, "reason");

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.payable.findFirst({
        where: { companyId: context.companyId, id: input.payableId },
      });
      if (!current) {
        throw new PayableNotFoundError("Resource not found");
      }
      if (current.status === "CANCELED") {
        if (current.cancellationReason === reason) {
          return serializePayable(current);
        }
        throw new PayableConflictError(
          "Payable was canceled with another reason",
        );
      }
      if (current.status !== "OPEN") {
        throw new PayableConflictError("Paid payable must be reversed first");
      }
      if (current.version !== input.expectedVersion) {
        throw new PayableConflictError("Payable version conflict");
      }

      const canceledAt = new Date();
      const transitioned = await transaction.payable.updateMany({
        data: {
          canceledAt,
          canceledByUserId: context.userId,
          cancellationReason: reason,
          status: "CANCELED",
          updatedByUserId: context.userId,
          version: { increment: 1 },
        },
        where: {
          companyId: context.companyId,
          id: current.id,
          status: "OPEN",
          version: input.expectedVersion,
        },
      });
      if (transitioned.count !== 1) {
        throw new PayableConflictError("Payable transition conflict");
      }
      const payable = await transaction.payable.findFirstOrThrow({
        where: { companyId: context.companyId, id: current.id },
      });
      await transaction.payableAuditEvent.create({
        data: {
          action: "CANCELED",
          actorUserId: context.userId,
          changes: { status: { from: "OPEN", to: "CANCELED" } },
          companyId: context.companyId,
          newVersion: payable.version,
          payableId: payable.id,
          previousVersion: current.version,
          reason,
          requestId: context.requestId,
        },
      });
      return serializePayable(payable);
    });
  }
}

export const PAYABLE_USE_CASES = [
  CancelOpenPayable,
  CreatePayable,
  PayPayable,
  ReversePayablePayment,
  UpdateOpenPayable,
];

export { IdempotencyConflictError };
