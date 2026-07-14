import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { IdentityResolver } from "./identity-resolver.service";

function resolver(result: { userId: string } | null) {
  const findUnique = vi.fn(async () => result);
  return {
    findUnique,
    service: new IdentityResolver({
      userIdentity: { findUnique },
    } as unknown as PrismaService),
  };
}

describe("IdentityResolver", () => {
  it("resolves only the exact issuer and subject", async () => {
    const { findUnique, service } = resolver({ userId: "internal-user" });
    await expect(
      service.resolve({ issuer: "https://tenant/", subject: "auth0|123" }),
    ).resolves.toEqual({
      issuer: "https://tenant/",
      subject: "auth0|123",
      userId: "internal-user",
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          issuer_subject: { issuer: "https://tenant/", subject: "auth0|123" },
        },
      }),
    );
  });

  it.each([
    ["same email with another subject", "https://tenant/", "auth0|other"],
    ["same subject in another issuer", "https://other/", "auth0|123"],
  ])("does not provision by %s", async (_case, issuer, subject) => {
    const { service } = resolver(null);
    await expect(service.resolve({ issuer, subject })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "IDENTITY_NOT_PROVISIONED" }),
    });
  });
});
