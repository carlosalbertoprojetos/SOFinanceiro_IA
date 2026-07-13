import type {
  Payable,
  PayablePayment,
  PayablePaymentReversal,
} from "../generated/prisma/client";

import { serializeCivilDate } from "./domain/civil-date";
import { Money } from "./domain/money";
import { PayablesValidationError } from "./payables.errors";
import type {
  AuthorizedCommandContext,
  PayableView,
  PaymentView,
  ReversalView,
} from "./payables.types";

export function assertMutationContext(context: AuthorizedCommandContext): void {
  if (context.role !== "OWNER" && context.role !== "ADMIN") {
    throw new PayablesValidationError("Role cannot mutate payables");
  }
  requiredText(context.requestId, 128, "requestId");
}

export function requiredText(
  value: string,
  maxLength: number,
  field: string,
): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new PayablesValidationError(`Invalid ${field}`);
  }
  return value.trim();
}

export function optionalText(
  value: string | null | undefined,
  maxLength: number,
  field: string,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  return requiredText(value, maxLength, field);
}

export function serializePayable(payable: Payable): PayableView {
  return {
    amount: Money.fromPrisma(payable.amount, payable.currencyCode).toString(),
    cancellationReason: payable.cancellationReason,
    canceledAt: payable.canceledAt?.toISOString() ?? null,
    companyId: payable.companyId,
    competenceDate: serializeCivilDate(payable.competenceDate),
    createdAt: payable.createdAt.toISOString(),
    currencyCode: payable.currencyCode,
    description: payable.description,
    documentNumber: payable.documentNumber,
    dueDate: serializeCivilDate(payable.dueDate),
    id: payable.id,
    payeeName: payable.payeeName,
    status: payable.status,
    updatedAt: payable.updatedAt.toISOString(),
    version: payable.version,
  };
}

export function serializePayment(payment: PayablePayment): PaymentView {
  return {
    amount: Money.fromPrisma(payment.amount, payment.currencyCode).toString(),
    companyId: payment.companyId,
    currencyCode: payment.currencyCode,
    id: payment.id,
    paidOn: serializeCivilDate(payment.paidOn),
    payableId: payment.payableId,
    recordedAt: payment.recordedAt.toISOString(),
  };
}

export function serializeReversal(
  reversal: PayablePaymentReversal,
): ReversalView {
  return {
    companyId: reversal.companyId,
    id: reversal.id,
    paymentId: reversal.paymentId,
    reason: reversal.reason,
    reversedAt: reversal.reversedAt.toISOString(),
  };
}
