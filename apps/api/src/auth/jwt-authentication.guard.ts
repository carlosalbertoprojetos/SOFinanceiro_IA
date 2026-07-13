import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import type { AuthenticatedRequest } from "./authenticated-principal";
import { IdentityResolver } from "./identity-resolver.service";
import {
  TOKEN_VERIFIER,
  type TokenVerifier,
  type VerifiedTokenIdentity,
} from "./token-verifier";

@Injectable()
export class JwtAuthenticationGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER)
    private readonly tokenVerifier: TokenVerifier,
    private readonly identityResolver: IdentityResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    let identity: VerifiedTokenIdentity;
    try {
      identity = await this.tokenVerifier.verify(token);
    } catch {
      throw new UnauthorizedException("Authentication required");
    }

    request.principal = await this.identityResolver.resolve(identity);
    return true;
  }

  private extractBearerToken(
    authorization: string | string[] | undefined,
  ): string | undefined {
    if (typeof authorization !== "string") {
      return undefined;
    }

    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    return match?.[1];
  }
}
