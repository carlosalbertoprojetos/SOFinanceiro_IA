import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import {
  parseCivilDate,
  serializeCivilDate,
  todayInTimeZone,
} from "./domain/civil-date";
import {
  PayableNotFoundError,
  PayablesValidationError,
} from "./payables.errors";
import {
  requiredText,
  serializePayable,
  serializePayment,
  serializeReversal,
} from "./payables.helpers";
import type {
  AuthorizedCommandContext,
  PayableDetailResult,
  PayableListResult,
  PayableReadView,
} from "./payables.types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Sort = "due_asc" | "due_desc" | "created_desc";
type Cursor = { createdAt: string; dueDate?: string; id: string; sort: Sort };

export type ListPayablesInput = {
  cursor?: string;
  dueFrom?: string;
  dueTo?: string;
  overdue?: string;
  pageSize?: string;
  query?: string;
  sort?: string;
  status?: string;
};

function parseSort(value: string | undefined): Sort {
  if (value === undefined) return "due_asc";
  if (value === "due_asc" || value === "due_desc" || value === "created_desc")
    return value;
  throw new PayablesValidationError("Invalid sort");
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_SIZE) {
    throw new PayablesValidationError("Invalid pageSize");
  }
  return parsed;
}

function parseCursor(value: string | undefined, sort: Sort): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<Cursor>;
    if (
      parsed.sort !== sort ||
      !parsed.id ||
      !UUID_PATTERN.test(parsed.id) ||
      !parsed.createdAt
    )
      throw new Error();
    if (Number.isNaN(Date.parse(parsed.createdAt))) throw new Error();
    if (
      sort !== "created_desc" &&
      (!parsed.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate))
    )
      throw new Error();
    return parsed as Cursor;
  } catch {
    throw new PayablesValidationError("Invalid cursor");
  }
}

function orderBy(sort: Sort): Prisma.PayableOrderByWithRelationInput[] {
  if (sort === "created_desc") return [{ createdAt: "desc" }, { id: "desc" }];
  const direction = sort === "due_desc" ? "desc" : "asc";
  return [{ dueDate: direction }, { createdAt: direction }, { id: direction }];
}

function cursorWhere(
  cursor: Cursor | null,
): Prisma.PayableWhereInput | undefined {
  if (!cursor) return undefined;
  const createdAt = new Date(cursor.createdAt);
  const direction = cursor.sort === "due_asc" ? "gt" : "lt";
  if (cursor.sort === "created_desc") {
    return {
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: cursor.id } },
      ],
    };
  }
  if (!cursor.dueDate) {
    throw new PayablesValidationError("Invalid cursor");
  }
  const dueDate = parseCivilDate(cursor.dueDate);
  return {
    OR: [
      { dueDate: { [direction]: dueDate } },
      { dueDate, createdAt: { [direction]: createdAt } },
      { dueDate, createdAt, id: { [direction]: cursor.id } },
    ],
  };
}

function encodeCursor(
  payable: { createdAt: Date; dueDate: Date; id: string },
  sort: Sort,
): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: payable.createdAt.toISOString(),
      ...(sort === "created_desc"
        ? {}
        : { dueDate: serializeCivilDate(payable.dueDate) }),
      id: payable.id,
      sort,
    }),
  ).toString("base64url");
}

function permissions(context: AuthorizedCommandContext) {
  return { canMutate: context.role === "OWNER" || context.role === "ADMIN" };
}

function serializeRead(
  payable: Prisma.PayableGetPayload<{
    include: { payments: { include: { reversal: true } } };
  }>,
  today: string,
): PayableReadView {
  const payments = payable.payments.map((payment) => ({
    ...serializePayment(payment),
    reversal: payment.reversal ? serializeReversal(payment.reversal) : null,
  }));
  return {
    ...serializePayable(payable),
    activePayment:
      payments.find((payment) => payment.reversal === null) ?? null,
    overdue:
      payable.status === "OPEN" && serializeCivilDate(payable.dueDate) < today,
    payments,
  };
}

@Injectable()
export class ListPayables {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    context: AuthorizedCommandContext,
    input: ListPayablesInput,
  ): Promise<PayableListResult> {
    const sort = parseSort(input.sort);
    const pageSize = parsePageSize(input.pageSize);
    const cursor = parseCursor(input.cursor, sort);
    const company = await this.prisma.company.findUnique({
      select: { timezone: true },
      where: { id: context.companyId },
    });
    if (!company) throw new PayableNotFoundError("Resource not found");
    const today = todayInTimeZone(company.timezone);
    const filters: Prisma.PayableWhereInput[] = [];
    if (input.status) {
      if (!(["OPEN", "PAID", "CANCELED"] as string[]).includes(input.status))
        throw new PayablesValidationError("Invalid status");
      filters.push({ status: input.status as "OPEN" | "PAID" | "CANCELED" });
    }
    if (input.dueFrom)
      filters.push({ dueDate: { gte: parseCivilDate(input.dueFrom) } });
    if (input.dueTo)
      filters.push({ dueDate: { lte: parseCivilDate(input.dueTo) } });
    if (input.dueFrom && input.dueTo && input.dueFrom > input.dueTo)
      throw new PayablesValidationError("Invalid due date range");
    if (input.query !== undefined) {
      const query = requiredText(input.query, 100, "query");
      filters.push({
        OR: [
          { payeeName: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { documentNumber: { contains: query, mode: "insensitive" } },
        ],
      });
    }
    if (input.overdue !== undefined) {
      if (input.overdue === "true")
        filters.push({
          dueDate: { lt: parseCivilDate(today) },
          status: "OPEN",
        });
      else if (input.overdue === "false")
        filters.push({
          OR: [
            { status: { not: "OPEN" } },
            { dueDate: { gte: parseCivilDate(today) } },
          ],
        });
      else throw new PayablesValidationError("Invalid overdue");
    }
    const boundary = cursorWhere(cursor);
    if (boundary) filters.push(boundary);
    const rows = await this.prisma.payable.findMany({
      include: {
        payments: {
          include: { reversal: true },
          orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
        },
      },
      orderBy: orderBy(sort),
      take: pageSize + 1,
      where: {
        companyId: context.companyId,
        ...(filters.length ? { AND: filters } : {}),
      },
    });
    const hasNext = rows.length > pageSize;
    const page = rows.slice(0, pageSize);
    const lastItem = page.at(-1);
    return {
      items: page.map((payable) => serializeRead(payable, today)),
      nextCursor: hasNext && lastItem ? encodeCursor(lastItem, sort) : null,
      pageSize,
      permissions: permissions(context),
    };
  }
}

@Injectable()
export class GetPayable {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    context: AuthorizedCommandContext,
    payableId: string,
  ): Promise<PayableDetailResult> {
    const company = await this.prisma.company.findUnique({
      select: { timezone: true },
      where: { id: context.companyId },
    });
    const payable = await this.prisma.payable.findFirst({
      include: {
        payments: {
          include: { reversal: true },
          orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
        },
      },
      where: { companyId: context.companyId, id: payableId },
    });
    if (!company || !payable)
      throw new PayableNotFoundError("Resource not found");
    return {
      payable: serializeRead(payable, todayInTimeZone(company.timezone)),
      permissions: permissions(context),
    };
  }
}

export const PAYABLE_QUERIES = [GetPayable, ListPayables];
