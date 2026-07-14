import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import type { AuthenticatedRequest } from "./authenticated-principal";
import { MeController } from "./me.controller";

describe("MeController", () => {
  it("lists only memberships for the authenticated user with the database role", async () => {
    const findMany = vi.fn(async () => [
      {
        company: {
          currencyCode: "BRL",
          id: "company-own",
          name: "Empresa própria",
          timezone: "America/Sao_Paulo",
        },
        role: "MEMBER",
      },
    ]);
    const controller = new MeController({
      companyMembership: { findMany },
    } as unknown as PrismaService);
    const request = {
      principal: { issuer: "issuer", subject: "subject", userId: "user-own" },
    } as AuthenticatedRequest;

    await expect(controller.companies(request)).resolves.toEqual({
      companies: [
        {
          currencyCode: "BRL",
          id: "company-own",
          name: "Empresa própria",
          role: "MEMBER",
          timezone: "America/Sao_Paulo",
        },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-own" } }),
    );
  });

  it("returns no company after the membership is removed", async () => {
    const controller = new MeController({
      companyMembership: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaService);
    await expect(
      controller.companies({
        principal: { userId: "removed" },
      } as AuthenticatedRequest),
    ).resolves.toEqual({ companies: [] });
  });
});
