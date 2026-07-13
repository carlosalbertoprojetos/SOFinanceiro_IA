import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { MembershipRole } from "../generated/prisma/enums";
import { ALLOWED_ROLES_METADATA } from "./allowed-roles.decorator";
import type { AuthenticatedRequest } from "./authenticated-principal";
import { AuthorizationPolicy } from "./authorization-policy";

@Injectable()
export class RoleAuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: AuthorizationPolicy,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<MembershipRole[]>(
      ALLOWED_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!allowedRoles || !request.tenantContext) {
      throw new ForbiddenException("Operation not permitted");
    }

    this.policy.assertAllowed(request.tenantContext.role, allowedRoles);
    return true;
  }
}
