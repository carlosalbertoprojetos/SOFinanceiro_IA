import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://sofia:sofia_local@127.0.0.1:5433/sofia?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const testRunId = randomUUID();
const companyIds: string[] = [];
const userIds: string[] = [];

describe("foundational database constraints", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.$disconnect();
  });

  it("applies company defaults and prevents duplicate memberships", async () => {
    const company = await prisma.company.create({
      data: { name: `Empresa de teste ${testRunId}` },
    });
    companyIds.push(company.id);
    const user = await prisma.user.create({
      data: {
        email: `owner-${testRunId}@example.test`,
        name: "Responsável de teste",
      },
    });
    userIds.push(user.id);

    await prisma.companyMembership.create({
      data: {
        companyId: company.id,
        role: "OWNER",
        userId: user.id,
      },
    });

    expect(company).toMatchObject({
      currencyCode: "BRL",
      timezone: "America/Sao_Paulo",
    });
    await expect(
      prisma.companyMembership.create({
        data: {
          companyId: company.id,
          role: "MEMBER",
          userId: user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("prevents duplicate user email addresses", async () => {
    const email = `unique-${testRunId}@example.test`;
    const user = await prisma.user.create({
      data: { email, name: "Primeiro usuário" },
    });
    userIds.push(user.id);

    await expect(
      prisma.user.create({
        data: { email, name: "Segundo usuário" },
      }),
    ).rejects.toThrow();
  });
});
