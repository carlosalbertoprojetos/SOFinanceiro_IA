import { Inject, Injectable } from "@nestjs/common";

import { TOKEN_VERIFIER, type TokenVerifier } from "../auth/token-verifier";
import { PrismaService } from "../database/prisma.service";
import type { LivenessResult, ReadinessResult } from "./health.types";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
  ) {}

  live(): LivenessResult {
    return { service: "api", status: "ok" };
  }

  async ready(): Promise<ReadinessResult> {
    const authentication = this.verifier.readiness();
    let database: ReadinessResult["database"] = { status: "up" };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = { status: "down" };
    }

    const ready = authentication.configured && database.status === "up";
    return {
      authentication: authentication.configured
        ? { status: "up" }
        : { reason: authentication.reason, status: "down" },
      database,
      service: "api",
      status: ready ? "ok" : "degraded",
    };
  }
}
