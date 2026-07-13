import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { exportSPKI, generateKeyPair, SignJWT, type KeyLike } from "jose";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/database/prisma.service";

const issuer = "https://auth.integration.example.test";
const audience = "sofia-api";
const subject = `integration-subject-${randomUUID()}`;
const unknownSubject = `unknown-subject-${randomUUID()}`;
let app: INestApplication;
let baseUrl: string;
let companyId: string;
let otherCompanyId: string;
let privateKey: KeyLike;
let prisma: PrismaService;
let userId: string;

async function issueToken(tokenSubject = subject): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(issuer)
    .setSubject(tokenSubject)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

async function accessCheck(
  targetCompanyId: string,
  token?: string,
): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/companies/${targetCompanyId}/access-check`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

describe("protected company access check", () => {
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
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);

    const company = await prisma.company.create({
      data: { name: `Empresa autorizada ${randomUUID()}` },
    });
    const otherCompany = await prisma.company.create({
      data: { name: `Empresa isolada ${randomUUID()}` },
    });
    const user = await prisma.user.create({
      data: {
        email: `access-${randomUUID()}@example.test`,
        name: "Usuário do teste de acesso",
      },
    });

    companyId = company.id;
    otherCompanyId = otherCompany.id;
    userId = user.id;

    await prisma.userIdentity.create({
      data: { issuer, subject, userId },
    });
    await prisma.companyMembership.create({
      data: { companyId, role: "OWNER", userId },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.userIdentity.deleteMany({ where: { userId } });
      await prisma.companyMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
      await prisma.company.deleteMany({
        where: { id: { in: [companyId, otherCompanyId] } },
      });
    }
    await app?.close();
  });

  it("authenticates the identity and returns the current membership role", async () => {
    const token = await issueToken();
    const ownerResponse = await accessCheck(companyId, token);

    expect(ownerResponse.status).toBe(200);
    await expect(ownerResponse.json()).resolves.toEqual({
      access: "granted",
      role: "OWNER",
    });

    await prisma.companyMembership.update({
      data: { role: "MEMBER" },
      where: { companyId_userId: { companyId, userId } },
    });
    const memberResponse = await accessCheck(companyId, token);
    await expect(memberResponse.json()).resolves.toEqual({
      access: "granted",
      role: "MEMBER",
    });
  });

  it("rejects an absent or malformed bearer token", async () => {
    expect((await accessCheck(companyId)).status).toBe(401);
    expect((await accessCheck(companyId, "malformed-token")).status).toBe(401);
  });

  it("rejects a valid token without a mapped internal identity", async () => {
    const response = await accessCheck(
      companyId,
      await issueToken(unknownSubject),
    );
    expect(response.status).toBe(401);
  });

  it("does not reveal whether an inaccessible company exists", async () => {
    const token = await issueToken();
    const inaccessible = await accessCheck(otherCompanyId, token);
    const nonexistent = await accessCheck(randomUUID(), token);
    const inaccessibleBody = await inaccessible.json();
    const nonexistentBody = await nonexistent.json();

    expect(inaccessible.status).toBe(404);
    expect(nonexistent.status).toBe(404);
    expect(inaccessibleBody).toEqual(nonexistentBody);
  });
});
