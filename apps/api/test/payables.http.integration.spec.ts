import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { exportSPKI, generateKeyPair, SignJWT, type KeyLike } from "jose";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/database/prisma.service";
import { todayInTimeZone } from "../src/payables/domain/civil-date";
import { SofiaApiClient } from "../../web/src/lib/api-client";

describe("payables HTTP contract", () => {
  let app: INestApplication;
  let baseUrl: string;
  let companyId: string;
  let otherCompanyId: string;
  let privateKey: KeyLike;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const issuer = "https://auth.payables-http.example.test";
  const audience = "sofia-api";
  const subject = `payables-http-${randomUUID()}`;

  const createBody = {
    amount: "250.00",
    competenceDate: "2026-07-01",
    description: "Contrato mensal",
    dueDate: "2026-07-31",
    payeeName: "Prestador HTTP",
  };

  async function request(
    path: string,
    options: {
      body?: unknown;
      idempotencyKey?: string;
      method?: "GET" | "PATCH" | "POST";
    } = {},
  ): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
        "X-Request-ID": randomUUID(),
      },
      method: options.method ?? "POST",
    });
  }

  beforeAll(async () => {
    const keyPair = await generateKeyPair("RS256");
    privateKey = keyPair.privateKey;
    const publicKey = await exportSPKI(keyPair.publicKey);
    process.env.AUTH_JWT_ALGORITHM = "RS256";
    process.env.AUTH_JWT_AUDIENCE = audience;
    process.env.AUTH_JWT_ISSUER = issuer;
    process.env.AUTH_JWT_PUBLIC_KEY_BASE64 =
      Buffer.from(publicKey).toString("base64");

    const { AppModule } = await import("../src/app.module");
    app = await NestFactory.create(AppModule, {
      abortOnError: false,
      logger: false,
    });
    await app.listen(0, "127.0.0.1");
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);

    const company = await prisma.company.create({
      data: { name: `HTTP company ${randomUUID()}` },
    });
    const otherCompany = await prisma.company.create({
      data: { name: `HTTP other ${randomUUID()}` },
    });
    const user = await prisma.user.create({
      data: {
        email: `http-${randomUUID()}@example.test`,
        name: "HTTP owner",
      },
    });
    await prisma.userIdentity.create({
      data: { issuer, subject, userId: user.id },
    });
    await prisma.companyMembership.create({
      data: { companyId: company.id, role: "OWNER", userId: user.id },
    });
    companyId = company.id;
    otherCompanyId = otherCompany.id;
    userId = user.id;

    const now = Math.floor(Date.now() / 1000);
    token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(issuer)
      .setSubject(subject)
      .setAudience(audience)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateKey);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.payablePaymentReversal.deleteMany({ where: { companyId } });
      await prisma.payableAuditEvent.deleteMany({ where: { companyId } });
      await prisma.payablePayment.deleteMany({ where: { companyId } });
      await prisma.idempotencyRecord.deleteMany({ where: { companyId } });
      await prisma.payable.deleteMany({ where: { companyId } });
      await prisma.userIdentity.deleteMany({ where: { userId } });
      await prisma.companyMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
      await prisma.company.deleteMany({
        where: { id: { in: [companyId, otherCompanyId] } },
      });
    }
    await app?.close();
  });

  it("creates and replays the same minimal response for OWNER", async () => {
    const key = "http-create-replay";
    const first = await request(`/api/v1/companies/${companyId}/payables`, {
      body: createBody,
      idempotencyKey: key,
    });
    const replay = await request(`/api/v1/companies/${companyId}/payables`, {
      body: createBody,
      idempotencyKey: key,
    });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(await first.json());
  });

  it("communicates through the real typed frontend client", async () => {
    const client = new SofiaApiClient(token, baseUrl);
    const created = await client.create(
      companyId,
      { ...createBody, description: "Frontend contract" },
      "frontend-real-create",
    );
    const list = await client.list(
      companyId,
      new URLSearchParams("query=Frontend+contract"),
    );
    const detail = await client.detail(companyId, created.id);

    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.amount).toBe("250.00");
    expect(detail.payable.id).toBe(created.id);
  });

  it("lists an empty company for an authorized member", async () => {
    const emptyCompany = await prisma.company.create({
      data: { name: `Empty HTTP ${randomUUID()}` },
    });
    await prisma.companyMembership.create({
      data: { companyId: emptyCompany.id, role: "MEMBER", userId },
    });

    const response = await request(
      `/api/v1/companies/${emptyCompany.id}/payables`,
      { method: "GET" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [],
      nextCursor: null,
      permissions: { canMutate: false },
    });
    await prisma.companyMembership.delete({
      where: {
        companyId_userId: { companyId: emptyCompany.id, userId },
      },
    });
    await prisma.company.delete({ where: { id: emptyCompany.id } });
  });

  it("filters and paginates with an opaque stable cursor", async () => {
    for (const [index, dueDate] of ["2020-01-01", "2026-08-02"].entries()) {
      await request(`/api/v1/companies/${companyId}/payables`, {
        body: {
          ...createBody,
          description: `Cursor ${index}`,
          dueDate,
          payeeName: `Filtro Cursor ${index}`,
        },
        idempotencyKey: `http-query-cursor-${index}`,
      });
    }

    const first = await request(
      `/api/v1/companies/${companyId}/payables?query=Filtro%20Cursor&pageSize=1&sort=due_asc`,
      { method: "GET" },
    );
    const firstBody = (await first.json()) as {
      items: Array<{ amount: unknown; dueDate: string; overdue: boolean }>;
      nextCursor: string;
    };
    expect(first.status).toBe(200);
    expect(firstBody.items).toHaveLength(1);
    expect(typeof firstBody.items[0]?.amount).toBe("string");
    expect(firstBody.items[0]?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(firstBody.items[0]?.overdue).toBe(true);
    expect(firstBody.nextCursor).not.toContain("2020-01-01");

    const second = await request(
      `/api/v1/companies/${companyId}/payables?query=Filtro%20Cursor&pageSize=1&sort=due_asc&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      { method: "GET" },
    );
    await expect(second.json()).resolves.toMatchObject({
      items: [{ dueDate: "2026-08-02", overdue: false }],
      nextCursor: null,
    });
  });

  it("rejects invalid cursor and unsupported filters", async () => {
    const cursor = await request(
      `/api/v1/companies/${companyId}/payables?cursor=not-a-cursor`,
      { method: "GET" },
    );
    const status = await request(
      `/api/v1/companies/${companyId}/payables?status=ARCHIVED`,
      { method: "GET" },
    );
    expect(cursor.status).toBe(400);
    expect(status.status).toBe(400);
  });

  it("returns tenant-safe detail without audit or idempotency internals", async () => {
    const created = await request(`/api/v1/companies/${companyId}/payables`, {
      body: createBody,
      idempotencyKey: "http-detail-create",
    });
    const payable = (await created.json()) as { id: string };
    const detail = await request(
      `/api/v1/companies/${companyId}/payables/${payable.id}`,
      { method: "GET" },
    );
    const body = (await detail.json()) as Record<string, unknown>;
    expect(detail.status).toBe(200);
    expect(body).toMatchObject({
      payable: {
        activePayment: null,
        amount: "250.00",
        payments: [],
      },
      permissions: { canMutate: true },
    });
    expect(JSON.stringify(body)).not.toMatch(/audit|idempotency|requestId/i);

    const hidden = await request(
      `/api/v1/companies/${otherCompanyId}/payables/${payable.id}`,
      { method: "GET" },
    );
    expect(hidden.status).toBe(404);
  });

  it("rejects mass assignment and client-supplied payment amount", async () => {
    const massAssignment = await request(
      `/api/v1/companies/${companyId}/payables`,
      {
        body: { ...createBody, currencyCode: "USD" },
        idempotencyKey: "http-mass-assignment",
      },
    );
    expect(massAssignment.status).toBe(400);

    const created = await request(`/api/v1/companies/${companyId}/payables`, {
      body: createBody,
      idempotencyKey: "http-payment-body-create",
    });
    const payable = (await created.json()) as { id: string };
    const payment = await request(
      `/api/v1/companies/${companyId}/payables/${payable.id}/payments`,
      {
        body: {
          amount: "1.00",
          paidOn: todayInTimeZone("America/Sao_Paulo"),
        },
        idempotencyKey: "http-payment-mass-assignment",
      },
    );
    expect(payment.status).toBe(400);
  });

  it("uses current database role for OWNER, MEMBER and ADMIN", async () => {
    await prisma.companyMembership.update({
      data: { role: "MEMBER" },
      where: { companyId_userId: { companyId, userId } },
    });
    const member = await request(`/api/v1/companies/${companyId}/payables`, {
      body: createBody,
      idempotencyKey: "http-member-rejected",
    });
    expect(member.status).toBe(403);

    await prisma.companyMembership.update({
      data: { role: "ADMIN" },
      where: { companyId_userId: { companyId, userId } },
    });
    const admin = await request(`/api/v1/companies/${companyId}/payables`, {
      body: createBody,
      idempotencyKey: "http-admin-accepted",
    });
    expect(admin.status).toBe(201);
  });

  it("does not reveal a company without membership", async () => {
    const response = await request(
      `/api/v1/companies/${otherCompanyId}/payables`,
      { body: createBody, idempotencyKey: "http-other-tenant" },
    );

    expect(response.status).toBe(404);
  });

  it("executes payment, reversal and cancellation endpoints", async () => {
    const createdResponse = await request(
      `/api/v1/companies/${companyId}/payables`,
      { body: createBody, idempotencyKey: "http-full-flow-create" },
    );
    const created = (await createdResponse.json()) as {
      id: string;
      version: number;
    };
    const paidResponse = await request(
      `/api/v1/companies/${companyId}/payables/${created.id}/payments`,
      {
        body: { paidOn: todayInTimeZone("America/Sao_Paulo") },
        idempotencyKey: "http-full-flow-pay",
      },
    );
    expect(paidResponse.status).toBe(201);
    const paid = (await paidResponse.json()) as {
      payable: { status: string };
      payment: { id: string };
    };
    expect(paid.payable.status).toBe("PAID");

    const reversedResponse = await request(
      `/api/v1/companies/${companyId}/payables/${created.id}/payments/${paid.payment.id}/reversal`,
      {
        body: { reason: "Pagamento lançado incorretamente" },
        idempotencyKey: "http-full-flow-reversal",
      },
    );
    expect(reversedResponse.status).toBe(201);
    const reversed = (await reversedResponse.json()) as {
      payable: { status: string; version: number };
    };
    expect(reversed.payable.status).toBe("OPEN");

    const canceledResponse = await request(
      `/api/v1/companies/${companyId}/payables/${created.id}/cancellation`,
      {
        body: {
          expectedVersion: reversed.payable.version,
          reason: "Título substituído",
        },
      },
    );
    expect(canceledResponse.status).toBe(200);
    await expect(canceledResponse.json()).resolves.toMatchObject({
      status: "CANCELED",
    });

    const detailResponse = await request(
      `/api/v1/companies/${companyId}/payables/${created.id}`,
      { method: "GET" },
    );
    await expect(detailResponse.json()).resolves.toMatchObject({
      payable: {
        cancellationReason: "Título substituído",
        payments: [
          {
            amount: "250.00",
            reversal: { reason: "Pagamento lançado incorretamente" },
          },
        ],
        status: "CANCELED",
      },
    });
  });
});
