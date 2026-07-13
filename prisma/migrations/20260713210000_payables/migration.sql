-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('OPEN', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "PayableAuditAction" AS ENUM ('CREATED', 'UPDATED', 'PAID', 'PAYMENT_REVERSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "IdempotencyOperation" AS ENUM ('CREATE_PAYABLE', 'PAY_PAYABLE', 'REVERSE_PAYABLE_PAYMENT');

-- CreateEnum
CREATE TYPE "IdempotencyState" AS ENUM ('COMPLETED');

-- CreateTable
CREATE TABLE "Payable" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "payeeName" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "documentNumber" VARCHAR(100),
    "amount" DECIMAL(19,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "competenceDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "canceledAt" TIMESTAMPTZ(3),
    "canceledByUserId" UUID,
    "cancellationReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payable_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "Payable_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
    CONSTRAINT "Payable_version_positive" CHECK ("version" >= 1),
    CONSTRAINT "Payable_cancellation_coherent" CHECK (
      ("status" = 'CANCELED' AND "canceledAt" IS NOT NULL AND "canceledByUserId" IS NOT NULL AND length(btrim("cancellationReason")) > 0)
      OR
      ("status" <> 'CANCELED' AND "canceledAt" IS NULL AND "canceledByUserId" IS NULL AND "cancellationReason" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "PayablePayment" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "payableId" UUID NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "paidOn" DATE NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" UUID NOT NULL,

    CONSTRAINT "PayablePayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PayablePayment_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "PayablePayment_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$')
);

-- CreateTable
CREATE TABLE "PayablePaymentReversal" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "reversedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedByUserId" UUID NOT NULL,

    CONSTRAINT "PayablePaymentReversal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PayablePaymentReversal_reason" CHECK (length(btrim("reason")) > 0)
);

-- CreateTable
CREATE TABLE "PayableAuditEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "payableId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" "PayableAuditAction" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" VARCHAR(128) NOT NULL,
    "previousVersion" INTEGER,
    "newVersion" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "changes" JSONB NOT NULL,

    CONSTRAINT "PayableAuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PayableAuditEvent_versions" CHECK (
      "newVersion" >= 1 AND ("previousVersion" IS NULL OR "previousVersion" >= 1)
    ),
    CONSTRAINT "PayableAuditEvent_reason" CHECK (
      ("action" IN ('CANCELED', 'PAYMENT_REVERSED') AND length(btrim("reason")) > 0)
      OR ("action" NOT IN ('CANCELED', 'PAYMENT_REVERSED') AND "reason" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "operation" "IdempotencyOperation" NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "state" "IdempotencyState" NOT NULL DEFAULT 'COMPLETED',
    "httpStatus" INTEGER NOT NULL,
    "resourceType" VARCHAR(64) NOT NULL,
    "resourceId" UUID NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IdempotencyRecord_key" CHECK (length(btrim("idempotencyKey")) > 0),
    CONSTRAINT "IdempotencyRecord_hash" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "IdempotencyRecord_http_status" CHECK ("httpStatus" BETWEEN 200 AND 299),
    CONSTRAINT "IdempotencyRecord_expiry" CHECK ("expiresAt" > "createdAt")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payable_companyId_id_key" ON "Payable"("companyId", "id");
CREATE INDEX "Payable_companyId_status_dueDate_idx" ON "Payable"("companyId", "status", "dueDate");
CREATE UNIQUE INDEX "PayablePayment_companyId_id_key" ON "PayablePayment"("companyId", "id");
CREATE INDEX "PayablePayment_companyId_payableId_recordedAt_idx" ON "PayablePayment"("companyId", "payableId", "recordedAt");
CREATE UNIQUE INDEX "PayablePaymentReversal_companyId_paymentId_key" ON "PayablePaymentReversal"("companyId", "paymentId");
CREATE INDEX "PayablePaymentReversal_companyId_reversedAt_idx" ON "PayablePaymentReversal"("companyId", "reversedAt");
CREATE INDEX "PayableAuditEvent_companyId_payableId_occurredAt_idx" ON "PayableAuditEvent"("companyId", "payableId", "occurredAt");
CREATE INDEX "PayableAuditEvent_companyId_requestId_idx" ON "PayableAuditEvent"("companyId", "requestId");
CREATE UNIQUE INDEX "IdempotencyRecord_scope_key" ON "IdempotencyRecord"("companyId", "actorUserId", "operation", "idempotencyKey");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_companyId_createdByUserId_fkey" FOREIGN KEY ("companyId", "createdByUserId") REFERENCES "CompanyMembership"("companyId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_companyId_updatedByUserId_fkey" FOREIGN KEY ("companyId", "updatedByUserId") REFERENCES "CompanyMembership"("companyId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayablePayment" ADD CONSTRAINT "PayablePayment_companyId_payableId_fkey" FOREIGN KEY ("companyId", "payableId") REFERENCES "Payable"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayablePayment" ADD CONSTRAINT "PayablePayment_companyId_recordedByUserId_fkey" FOREIGN KEY ("companyId", "recordedByUserId") REFERENCES "CompanyMembership"("companyId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayablePaymentReversal" ADD CONSTRAINT "PayablePaymentReversal_companyId_paymentId_fkey" FOREIGN KEY ("companyId", "paymentId") REFERENCES "PayablePayment"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayablePaymentReversal" ADD CONSTRAINT "PayablePaymentReversal_companyId_reversedByUserId_fkey" FOREIGN KEY ("companyId", "reversedByUserId") REFERENCES "CompanyMembership"("companyId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableAuditEvent" ADD CONSTRAINT "PayableAuditEvent_companyId_payableId_fkey" FOREIGN KEY ("companyId", "payableId") REFERENCES "Payable"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableAuditEvent" ADD CONSTRAINT "PayableAuditEvent_companyId_actorUserId_fkey" FOREIGN KEY ("companyId", "actorUserId") REFERENCES "CompanyMembership"("companyId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_companyId_actorUserId_fkey" FOREIGN KEY ("companyId", "actorUserId") REFERENCES "CompanyMembership"("companyId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
