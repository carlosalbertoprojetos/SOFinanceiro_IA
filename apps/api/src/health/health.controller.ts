import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { HealthService } from "./health.service";
import type { HealthResult } from "./health.types";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthResult> {
    const result = await this.healthService.check();

    if (result.status !== "ok") {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
