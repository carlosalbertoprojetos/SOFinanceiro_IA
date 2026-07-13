import type { MembershipRole } from "../generated/prisma/enums";

export type AuthorizedCommandContext = {
  companyId: string;
  requestId: string;
  role: MembershipRole;
  userId: string;
};

export type PayableView = {
  amount: string;
  cancellationReason: string | null;
  canceledAt: string | null;
  companyId: string;
  competenceDate: string;
  createdAt: string;
  currencyCode: string;
  description: string;
  documentNumber: string | null;
  dueDate: string;
  id: string;
  payeeName: string;
  status: "OPEN" | "PAID" | "CANCELED";
  updatedAt: string;
  version: number;
};

export type PaymentView = {
  amount: string;
  companyId: string;
  currencyCode: string;
  id: string;
  paidOn: string;
  payableId: string;
  recordedAt: string;
};

export type ReversalView = {
  companyId: string;
  id: string;
  paymentId: string;
  reason: string;
  reversedAt: string;
};
