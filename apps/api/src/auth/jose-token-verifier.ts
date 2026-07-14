import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createLocalJWKSet,
  decodeProtectedHeader,
  errors,
  jwtVerify,
  type JSONWebKeySet,
} from "jose";

import type {
  TokenVerifier,
  TokenVerifierReadiness,
  VerifiedTokenIdentity,
} from "./token-verifier";

export const OIDC_FETCH = Symbol("OIDC_FETCH");

type Fetcher = typeof globalThis.fetch;
type CachedJwks = {
  freshUntil: number;
  jwks: JSONWebKeySet;
  staleUntil: number;
};

@Injectable()
export class JoseTokenVerifier implements TokenVerifier {
  private readonly algorithm = "RS256";
  private cachedJwks?: CachedJwks;
  private discovery?: { issuer: string; jwks_uri: string };
  private readonly audience?: string;
  private readonly issuer?: string;
  private readonly cacheTtlMs: number;
  private readonly staleTtlMs: number;

  constructor(
    configService: ConfigService,
    @Optional() @Inject(OIDC_FETCH) private readonly fetcher: Fetcher = fetch,
  ) {
    this.audience = configService.get<string>("AUTH0_AUDIENCE");
    this.issuer = configService.get<string>("AUTH0_ISSUER");
    this.cacheTtlMs =
      (configService.get<number>("AUTH0_JWKS_CACHE_TTL_SECONDS") ?? 600) * 1000;
    this.staleTtlMs =
      (configService.get<number>("AUTH0_JWKS_STALE_TTL_SECONDS") ?? 3600) *
      1000;
  }

  readiness(): TokenVerifierReadiness {
    if (!this.issuer || !this.audience) {
      return {
        configured: false,
        reason: "OIDC issuer or audience is missing",
      };
    }
    return { configured: true };
  }

  async verify(token: string): Promise<VerifiedTokenIdentity> {
    if (!this.issuer || !this.audience) {
      throw new Error("OIDC verifier is not configured");
    }

    const header = decodeProtectedHeader(token);
    if (header.alg !== this.algorithm || typeof header.kid !== "string") {
      throw new Error("JWT algorithm or key id is not allowed");
    }

    let jwks = await this.getJwks(false);
    try {
      return await this.verifyWith(token, jwks);
    } catch (error: unknown) {
      if (!(error instanceof errors.JWKSNoMatchingKey)) throw error;
      jwks = await this.getJwks(true);
      return this.verifyWith(token, jwks);
    }
  }

  private async verifyWith(
    token: string,
    jwks: JSONWebKeySet,
  ): Promise<VerifiedTokenIdentity> {
    const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
      algorithms: [this.algorithm],
      audience: this.audience,
      issuer: this.issuer,
      requiredClaims: ["iss", "sub", "aud", "exp", "iat"],
    });

    if (
      typeof payload.iat !== "number" ||
      payload.iat > Math.floor(Date.now() / 1000) ||
      typeof payload.iss !== "string" ||
      !payload.iss ||
      typeof payload.sub !== "string" ||
      !payload.sub
    ) {
      throw new Error("JWT identity or issued-at claim is invalid");
    }
    return { issuer: payload.iss, subject: payload.sub };
  }

  private async getJwks(forceRefresh: boolean): Promise<JSONWebKeySet> {
    const now = Date.now();
    if (!forceRefresh && this.cachedJwks && now < this.cachedJwks.freshUntil) {
      return this.cachedJwks.jwks;
    }

    try {
      const discovery = await this.getDiscovery();
      const response = await this.fetcher(discovery.jwks_uri, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error("JWKS endpoint is unavailable");
      const value: unknown = await response.json();
      if (!isJwks(value)) throw new Error("JWKS response is invalid");
      this.cachedJwks = {
        freshUntil: now + this.cacheTtlMs,
        jwks: value,
        staleUntil: now + this.staleTtlMs,
      };
      return value;
    } catch (error: unknown) {
      if (this.cachedJwks && now < this.cachedJwks.staleUntil) {
        return this.cachedJwks.jwks;
      }
      throw error;
    }
  }

  private async getDiscovery(): Promise<{ issuer: string; jwks_uri: string }> {
    if (this.discovery) return this.discovery;
    if (!this.issuer) throw new Error("OIDC issuer is not configured");

    const url = new URL(
      ".well-known/openid-configuration",
      ensureTrailingSlash(this.issuer),
    );
    const response = await this.fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("OIDC discovery is unavailable");
    const value: unknown = await response.json();
    if (!isDiscovery(value, this.issuer) || value.issuer !== this.issuer) {
      throw new Error("OIDC discovery response is invalid");
    }
    this.discovery = value;
    return value;
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function isDiscovery(
  value: unknown,
  expectedIssuer: string,
): value is { issuer: string; jwks_uri: string } {
  const jwksUrl =
    typeof value === "object" &&
    value !== null &&
    "jwks_uri" in value &&
    typeof value.jwks_uri === "string" &&
    URL.canParse(value.jwks_uri)
      ? new URL(value.jwks_uri)
      : undefined;
  return (
    typeof value === "object" &&
    value !== null &&
    "issuer" in value &&
    typeof value.issuer === "string" &&
    jwksUrl !== undefined &&
    jwksUrl.origin === new URL(expectedIssuer).origin &&
    (jwksUrl.protocol === "https:" ||
      ((jwksUrl.hostname === "127.0.0.1" || jwksUrl.hostname === "localhost") &&
        new URL(expectedIssuer).hostname === jwksUrl.hostname))
  );
}

function isJwks(value: unknown): value is JSONWebKeySet {
  return (
    typeof value === "object" &&
    value !== null &&
    "keys" in value &&
    Array.isArray(value.keys) &&
    value.keys.length > 0
  );
}
