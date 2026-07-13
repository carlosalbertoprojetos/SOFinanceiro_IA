import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { HealthService } from "./health.service";

function createPrismaMock(query: () => Promise<unknown>): PrismaService {
  return {
    $queryRaw: vi.fn(query),
  } as unknown as PrismaService;
}

describe("HealthService", () => {
  it("reports the application and database as available", async () => {
    const service = new HealthService(
      createPrismaMock(async () => [{ result: 1 }]),
    );

    await expect(service.check()).resolves.toEqual({
      database: { status: "up" },
      service: "api",
      status: "ok",
    });
  });

  it("reports a degraded state when the database is unavailable", async () => {
    const service = new HealthService(
      createPrismaMock(async () =>
        Promise.reject(new Error("database unavailable")),
      ),
    );

    await expect(service.check()).resolves.toEqual({
      database: { status: "down" },
      service: "api",
      status: "degraded",
    });
  });
});
