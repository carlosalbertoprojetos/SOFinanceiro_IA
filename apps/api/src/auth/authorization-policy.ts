import { ForbiddenException, Injectable } from "@nestjs/common";

import type { MembershipRole } from "../generated/prisma/enums";

@Injectable()
export class AuthorizationPolicy {
  isAllowed(
    currentRole: MembershipRole,
    allowedRoles: MembershipRole[],
  ): boolean {
    return allowedRoles.includes(currentRole);
  }

  assertAllowed(
    currentRole: MembershipRole,
    allowedRoles: MembershipRole[],
  ): void {
    if (!this.isAllowed(currentRole, allowedRoles)) {
      throw new ForbiddenException("Operation not permitted");
    }
  }
}
