import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import type { HealthResult } from "./health.types";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        database: { status: "up" },
        service: "api",
        status: "ok",
      };
    } catch {
      return {
        database: { status: "down" },
        service: "api",
        status: "degraded",
      };
    }
  }
}
