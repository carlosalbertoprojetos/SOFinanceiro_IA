import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { PayablesController } from "./payables.controller";
import { PAYABLE_USE_CASES } from "./payables.use-cases";

@Module({
  controllers: [PayablesController],
  imports: [AuthModule],
  providers: [IdempotencyService, ...PAYABLE_USE_CASES],
})
export class PayablesModule {}
