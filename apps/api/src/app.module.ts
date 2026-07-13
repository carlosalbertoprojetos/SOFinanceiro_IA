import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { validateEnvironment } from "./config/environment";
import { PrismaModule } from "./database/prisma.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ["../../.env", ".env"],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
