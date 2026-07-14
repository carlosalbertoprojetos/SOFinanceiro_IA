import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { HealthService } from "./health.service";
import type { LivenessResult, ReadinessResult } from "./health.types";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("live")
  live(): LivenessResult {
    return this.healthService.live();
  }

  @Get("ready")
  async ready(): Promise<ReadinessResult> {
    const result = await this.healthService.ready();
    if (result.status !== "ok") throw new ServiceUnavailableException(result);
    return result;
  }
}
