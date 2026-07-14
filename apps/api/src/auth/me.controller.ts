import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import type { AuthenticatedRequest } from "./authenticated-principal";
import { JwtAuthenticationGuard } from "./jwt-authentication.guard";

@Controller("api/v1/me")
@UseGuards(JwtAuthenticationGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("companies")
  async companies(@Req() request: AuthenticatedRequest) {
    if (!request.principal)
      throw new UnauthorizedException("Authentication required");
    const memberships = await this.prisma.companyMembership.findMany({
      orderBy: { company: { name: "asc" } },
      select: {
        company: {
          select: {
            currencyCode: true,
            id: true,
            name: true,
            timezone: true,
          },
        },
        role: true,
      },
      where: { userId: request.principal.userId },
    });

    return {
      companies: memberships.map(({ company, role }) => ({ ...company, role })),
    };
  }
}
