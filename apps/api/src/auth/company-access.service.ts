import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import type { TenantContext } from "./authenticated-principal";

@Injectable()
export class CompanyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantContext(
    userId: string,
    companyId: string,
  ): Promise<TenantContext> {
    const membership = await this.prisma.companyMembership.findUnique({
      select: { id: true, role: true },
      where: { companyId_userId: { companyId, userId } },
    });

    if (!membership) {
      throw new NotFoundException("Resource not found");
    }

    return {
      companyId,
      membershipId: membership.id,
      role: membership.role,
      userId,
    };
  }
}
