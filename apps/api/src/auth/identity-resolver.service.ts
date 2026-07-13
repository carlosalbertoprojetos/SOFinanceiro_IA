import { Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import type { AuthenticatedPrincipal } from "./authenticated-principal";
import type { VerifiedTokenIdentity } from "./token-verifier";

@Injectable()
export class IdentityResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    identity: VerifiedTokenIdentity,
  ): Promise<AuthenticatedPrincipal> {
    const userIdentity = await this.prisma.userIdentity.findUnique({
      select: { userId: true },
      where: {
        issuer_subject: {
          issuer: identity.issuer,
          subject: identity.subject,
        },
      },
    });

    if (!userIdentity) {
      throw new UnauthorizedException("Authentication required");
    }

    return {
      issuer: identity.issuer,
      subject: identity.subject,
      userId: userIdentity.userId,
    };
  }
}
