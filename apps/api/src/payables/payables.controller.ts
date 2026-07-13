import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { AllowedRoles } from "../auth/allowed-roles.decorator";
import type { AuthenticatedRequest } from "../auth/authenticated-principal";
import { CompanyAccessGuard } from "../auth/company-access.guard";
import { JwtAuthenticationGuard } from "../auth/jwt-authentication.guard";
import { RoleAuthorizationGuard } from "../auth/role-authorization.guard";
import {
  IdempotencyConflictError,
  PayableConflictError,
  PayableNotFoundError,
  PayablesDomainError,
  PayablesValidationError,
} from "./payables.errors";
import type { AuthorizedCommandContext } from "./payables.types";
import {
  CancelOpenPayable,
  CreatePayable,
  PayPayable,
  ReversePayablePayment,
  UpdateOpenPayable,
} from "./payables.use-cases";

type JsonObject = Record<string, unknown>;

function objectBody(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Request body must be an object");
  }
  return value as JsonObject;
}

function allowedKeys(body: JsonObject, keys: string[]): void {
  const unexpected = Object.keys(body).filter((key) => !keys.includes(key));
  if (unexpected.length) {
    throw new BadRequestException(`Unexpected field: ${unexpected[0]}`);
  }
}

function stringField(body: JsonObject, field: string): string {
  const value = body[field];
  if (typeof value !== "string") {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return value;
}

function optionalStringField(
  body: JsonObject,
  field: string,
): string | null | undefined {
  const value = body[field];
  if (value === undefined || value === null || typeof value === "string") {
    return value;
  }
  throw new BadRequestException(`Invalid ${field}`);
}

function integerField(body: JsonObject, field: string): number {
  const value = body[field];
  if (!Number.isInteger(value)) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return value as number;
}

function idempotencyKey(value: string | undefined): string {
  if (!value) {
    throw new BadRequestException("Idempotency-Key header is required");
  }
  return value;
}

function commandContext(
  request: AuthenticatedRequest,
  requestId: string | undefined,
): AuthorizedCommandContext {
  if (!request.tenantContext) {
    throw new ForbiddenException("Operation not permitted");
  }
  return {
    ...request.tenantContext,
    requestId: requestId ?? randomUUID(),
  };
}

function mapError(error: unknown): never {
  if (error instanceof PayableNotFoundError) {
    throw new NotFoundException("Resource not found");
  }
  if (
    error instanceof PayableConflictError ||
    error instanceof IdempotencyConflictError
  ) {
    throw new ConflictException(error.message);
  }
  if (
    error instanceof PayablesValidationError ||
    error instanceof PayablesDomainError
  ) {
    throw new BadRequestException(error.message);
  }
  throw error;
}

@Controller("api/v1/companies/:companyId/payables")
@UseGuards(JwtAuthenticationGuard, CompanyAccessGuard, RoleAuthorizationGuard)
@AllowedRoles("OWNER", "ADMIN")
export class PayablesController {
  constructor(
    private readonly cancelOpenPayable: CancelOpenPayable,
    private readonly createPayable: CreatePayable,
    private readonly payPayable: PayPayable,
    private readonly reversePayment: ReversePayablePayment,
    private readonly updateOpenPayable: UpdateOpenPayable,
  ) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") key: string | undefined,
    @Headers("x-request-id") requestId: string | undefined,
    @Body() rawBody: unknown,
  ): Promise<unknown> {
    const body = objectBody(rawBody);
    allowedKeys(body, [
      "amount",
      "competenceDate",
      "description",
      "documentNumber",
      "dueDate",
      "payeeName",
    ]);
    try {
      return await this.createPayable.execute(
        commandContext(request, requestId),
        {
          amount: stringField(body, "amount"),
          competenceDate: stringField(body, "competenceDate"),
          description: stringField(body, "description"),
          documentNumber: optionalStringField(body, "documentNumber"),
          dueDate: stringField(body, "dueDate"),
          idempotencyKey: idempotencyKey(key),
          payeeName: stringField(body, "payeeName"),
        },
      );
    } catch (error) {
      mapError(error);
    }
  }

  @Patch(":payableId")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("payableId") payableId: string,
    @Headers("x-request-id") requestId: string | undefined,
    @Body() rawBody: unknown,
  ): Promise<unknown> {
    const body = objectBody(rawBody);
    allowedKeys(body, [
      "amount",
      "competenceDate",
      "description",
      "documentNumber",
      "dueDate",
      "expectedVersion",
      "payeeName",
    ]);
    try {
      return await this.updateOpenPayable.execute(
        commandContext(request, requestId),
        {
          amount: optionalStringField(body, "amount") ?? undefined,
          competenceDate:
            optionalStringField(body, "competenceDate") ?? undefined,
          description: optionalStringField(body, "description") ?? undefined,
          documentNumber: optionalStringField(body, "documentNumber"),
          dueDate: optionalStringField(body, "dueDate") ?? undefined,
          expectedVersion: integerField(body, "expectedVersion"),
          payeeName: optionalStringField(body, "payeeName") ?? undefined,
          payableId,
        },
      );
    } catch (error) {
      mapError(error);
    }
  }

  @Post(":payableId/payments")
  async pay(
    @Req() request: AuthenticatedRequest,
    @Param("payableId") payableId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Headers("x-request-id") requestId: string | undefined,
    @Body() rawBody: unknown,
  ): Promise<unknown> {
    const body = objectBody(rawBody);
    allowedKeys(body, ["paidOn"]);
    try {
      return await this.payPayable.execute(commandContext(request, requestId), {
        idempotencyKey: idempotencyKey(key),
        paidOn: stringField(body, "paidOn"),
        payableId,
      });
    } catch (error) {
      mapError(error);
    }
  }

  @Post(":payableId/payments/:paymentId/reversal")
  async reverse(
    @Req() request: AuthenticatedRequest,
    @Param("payableId") payableId: string,
    @Param("paymentId") paymentId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Headers("x-request-id") requestId: string | undefined,
    @Body() rawBody: unknown,
  ): Promise<unknown> {
    const body = objectBody(rawBody);
    allowedKeys(body, ["reason"]);
    try {
      return await this.reversePayment.execute(
        commandContext(request, requestId),
        {
          idempotencyKey: idempotencyKey(key),
          payableId,
          paymentId,
          reason: stringField(body, "reason"),
        },
      );
    } catch (error) {
      mapError(error);
    }
  }

  @Post(":payableId/cancellation")
  @HttpCode(200)
  async cancel(
    @Req() request: AuthenticatedRequest,
    @Param("payableId") payableId: string,
    @Headers("x-request-id") requestId: string | undefined,
    @Body() rawBody: unknown,
  ): Promise<unknown> {
    const body = objectBody(rawBody);
    allowedKeys(body, ["expectedVersion", "reason"]);
    try {
      return await this.cancelOpenPayable.execute(
        commandContext(request, requestId),
        {
          expectedVersion: integerField(body, "expectedVersion"),
          payableId,
          reason: stringField(body, "reason"),
        },
      );
    } catch (error) {
      mapError(error);
    }
  }
}
