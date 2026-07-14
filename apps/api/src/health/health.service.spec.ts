import { describe, expect, it, vi } from "vitest";

import type { TokenVerifier } from "../auth/token-verifier";
import type { PrismaService } from "../database/prisma.service";
import { HealthService } from "./health.service";

function prisma(query: () => Promise<unknown>): PrismaService {
  return { $queryRaw: vi.fn(query) } as unknown as PrismaService;
}

function verifier(configured: boolean): TokenVerifier {
  return {
    readiness: () =>
      configured
        ? { configured: true }
        : { configured: false, reason: "missing" },
    verify: vi.fn(),
  };
}

describe("HealthService", () => {
  it("liveness has no database or OIDC dependency", () => {
    const service = new HealthService(
      prisma(async () => Promise.reject()),
      verifier(false),
    );
    expect(service.live()).toEqual({ service: "api", status: "ok" });
  });

  it("reports ready when database and verifier configuration are available", async () => {
    const service = new HealthService(
      prisma(async () => [{ result: 1 }]),
      verifier(true),
    );
    await expect(service.ready()).resolves.toEqual({
      authentication: { status: "up" },
      database: { status: "up" },
      service: "api",
      status: "ok",
    });
  });

  it("reports degraded without OIDC configuration", async () => {
    const service = new HealthService(
      prisma(async () => [{ result: 1 }]),
      verifier(false),
    );
    await expect(service.ready()).resolves.toMatchObject({
      authentication: { reason: "missing", status: "down" },
      status: "degraded",
    });
  });
});
