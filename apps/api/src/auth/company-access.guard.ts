import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import type { AuthenticatedRequest } from "./authenticated-principal";
import { CompanyAccessService } from "./company-access.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(private readonly companyAccess: CompanyAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const companyId = request.params.companyId;

    if (!request.principal) {
      throw new UnauthorizedException("Authentication required");
    }

    if (!companyId || !UUID_PATTERN.test(companyId)) {
      throw new NotFoundException("Resource not found");
    }

    request.tenantContext = await this.companyAccess.getTenantContext(
      request.principal.userId,
      companyId,
    );
    return true;
  }
}
