import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { Prisma } from "../generated/prisma/client";
import type { IdempotencyOperation } from "../generated/prisma/enums";
import { PrismaService } from "../database/prisma.service";
import { IdempotencyConflictError } from "../payables/payables.errors";

const RETENTION_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const MAX_SERIALIZATION_RETRIES = 3;

type StoredResult<T> = {
  httpStatus: number;
  resourceId: string;
  resourceType: string;
  response: T;
};

type ExecuteInput<T> = {
  actorUserId: string;
  companyId: string;
  idempotencyKey: string;
  operation: IdempotencyOperation;
  payload: unknown;
  run: (transaction: Prisma.TransactionClient) => Promise<StoredResult<T>>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function payloadHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}

function isRetryable(error: unknown): boolean {
  const adapterError = error as {
    cause?: { kind?: string };
    message?: string;
    name?: string;
  };
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")) ||
    (adapterError.name === "DriverAdapterError" &&
      (adapterError.cause?.kind === "TransactionWriteConflict" ||
        adapterError.message?.includes("TransactionWriteConflict") === true))
  );
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(input: ExecuteInput<T>): Promise<StoredResult<T>> {
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 128) {
      throw new IdempotencyConflictError("Invalid idempotency key");
    }

    const hash = payloadHash(input.payload);
    for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const scope = {
              actorUserId: input.actorUserId,
              companyId: input.companyId,
              idempotencyKey: input.idempotencyKey,
              operation: input.operation,
            } as const;
            const lockScope = [
              scope.companyId,
              scope.actorUserId,
              scope.operation,
              scope.idempotencyKey,
            ].join(":");
            await transaction.$executeRaw(
              Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))`,
            );
            const existing = await transaction.idempotencyRecord.findUnique({
              where: {
                companyId_actorUserId_operation_idempotencyKey: scope,
              },
            });

            if (existing && existing.expiresAt > new Date()) {
              if (existing.payloadHash !== hash) {
                throw new IdempotencyConflictError(
                  "Idempotency key was already used with a different payload",
                );
              }
              return {
                httpStatus: existing.httpStatus,
                resourceId: existing.resourceId,
                resourceType: existing.resourceType,
                response: existing.response as T,
              };
            }
            if (existing) {
              await transaction.idempotencyRecord.delete({
                where: {
                  companyId_actorUserId_operation_idempotencyKey: scope,
                },
              });
            }

            const result = await input.run(transaction);
            const now = new Date();
            await transaction.idempotencyRecord.create({
              data: {
                ...scope,
                expiresAt: new Date(now.getTime() + RETENTION_MILLISECONDS),
                httpStatus: result.httpStatus,
                payloadHash: hash,
                resourceId: result.resourceId,
                resourceType: result.resourceType,
                response: result.response as Prisma.InputJsonValue,
              },
            });
            return result;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
        );
      } catch (error) {
        if (!isRetryable(error) || attempt === MAX_SERIALIZATION_RETRIES) {
          throw error;
        }
      }
    }
    throw new Error("Unreachable idempotency retry state");
  }
}
