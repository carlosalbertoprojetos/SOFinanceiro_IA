import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";

import type { MembershipRole } from "../generated/prisma/enums";
import { AllowedRoles } from "./allowed-roles.decorator";
import type { AuthenticatedRequest } from "./authenticated-principal";
import { CompanyAccessGuard } from "./company-access.guard";
import { JwtAuthenticationGuard } from "./jwt-authentication.guard";
import { RoleAuthorizationGuard } from "./role-authorization.guard";

type AccessCheckResponse = {
  access: "granted";
  role: MembershipRole;
};

@Controller("api/v1/companies/:companyId/access-check")
@UseGuards(JwtAuthenticationGuard, CompanyAccessGuard, RoleAuthorizationGuard)
@AllowedRoles("OWNER", "ADMIN", "MEMBER")
export class AccessCheckController {
  @Get()
  check(@Req() request: AuthenticatedRequest): AccessCheckResponse {
    if (!request.tenantContext) {
      throw new ForbiddenException("Operation not permitted");
    }

    return {
      access: "granted",
      role: request.tenantContext.role,
    };
  }
}
