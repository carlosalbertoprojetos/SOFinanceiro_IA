import { Module } from "@nestjs/common";

import { AuthorizationPolicy } from "./authorization-policy";
import { CompanyAccessGuard } from "./company-access.guard";
import { CompanyAccessService } from "./company-access.service";
import { IdentityResolver } from "./identity-resolver.service";
import { JoseTokenVerifier } from "./jose-token-verifier";
import { JwtAuthenticationGuard } from "./jwt-authentication.guard";
import { RoleAuthorizationGuard } from "./role-authorization.guard";
import { TOKEN_VERIFIER } from "./token-verifier";

@Module({
  exports: [
    AuthorizationPolicy,
    CompanyAccessGuard,
    CompanyAccessService,
    IdentityResolver,
    JwtAuthenticationGuard,
    RoleAuthorizationGuard,
    TOKEN_VERIFIER,
  ],
  providers: [
    AuthorizationPolicy,
    CompanyAccessGuard,
    CompanyAccessService,
    IdentityResolver,
    JwtAuthenticationGuard,
    RoleAuthorizationGuard,
    { provide: TOKEN_VERIFIER, useClass: JoseTokenVerifier },
  ],
})
export class AuthModule {}
