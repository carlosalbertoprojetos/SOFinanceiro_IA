import { describe, expect, it } from "vitest";

import { validateEnvironment } from "./environment";

const databaseUrl = "postgresql://user:password@localhost:5432/database";

describe("validateEnvironment", () => {
  it("rejects configuration without DATABASE_URL", () => {
    expect(() => validateEnvironment({})).toThrow(
      "Invalid environment configuration",
    );
  });

  it("allows degraded startup without OIDC so liveness remains available", () => {
    expect(validateEnvironment({ DATABASE_URL: databaseUrl })).toMatchObject({
      API_PORT: 3001,
      AUTH0_JWKS_CACHE_TTL_SECONDS: 600,
      AUTH0_JWKS_STALE_TTL_SECONDS: 3600,
      TZ: "America/Sao_Paulo",
    });
  });

  it("requires issuer and audience together", () => {
    expect(() =>
      validateEnvironment({
        AUTH0_ISSUER: "https://tenant.auth0.com/",
        DATABASE_URL: databaseUrl,
      }),
    ).toThrow("Invalid environment configuration");
  });

  it("accepts a complete OIDC verifier configuration", () => {
    expect(
      validateEnvironment({
        AUTH0_AUDIENCE: "https://api.sofia.local",
        AUTH0_ISSUER: "https://tenant.auth0.com/",
        DATABASE_URL: databaseUrl,
      }),
    ).toMatchObject({
      AUTH0_AUDIENCE: "https://api.sofia.local",
      AUTH0_ISSUER: "https://tenant.auth0.com/",
    });
  });

  it("rejects an insecure issuer in production", () => {
    expect(() =>
      validateEnvironment({
        AUTH0_AUDIENCE: "https://api.sofia.local",
        AUTH0_ISSUER: "http://auth.example.test/",
        DATABASE_URL: databaseUrl,
        NODE_ENV: "production",
      }),
    ).toThrow("Invalid environment configuration");
  });
});
