import { describe, expect, it } from "vitest";

import { validateEnvironment } from "./environment";

const publicKeyBase64 = Buffer.from(
  "-----BEGIN PUBLIC KEY-----\ntest-public-key\n-----END PUBLIC KEY-----\n",
).toString("base64");

describe("validateEnvironment", () => {
  it("rejects configuration without DATABASE_URL", () => {
    expect(() => validateEnvironment({})).toThrow(
      "Invalid environment configuration",
    );
  });

  it("rejects API startup configuration without JWT verification", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "postgresql://user:password@localhost:5432/database",
      }),
    ).toThrow("Invalid environment configuration");
  });

  it("applies safe local defaults", () => {
    const environment = validateEnvironment({
      AUTH_JWT_AUDIENCE: "sofia-api",
      AUTH_JWT_ISSUER: "https://auth.example.test",
      AUTH_JWT_PUBLIC_KEY_BASE64: publicKeyBase64,
      DATABASE_URL: "postgresql://user:password@localhost:5432/database",
    });

    expect(environment).toMatchObject({
      API_PORT: 3001,
      AUTH_JWT_ALGORITHM: "RS256",
      TZ: "America/Sao_Paulo",
      WEB_ORIGIN: "http://localhost:3000",
    });
  });

  it("rejects a public key that is not PEM encoded", () => {
    expect(() =>
      validateEnvironment({
        AUTH_JWT_AUDIENCE: "sofia-api",
        AUTH_JWT_ISSUER: "https://auth.example.test",
        AUTH_JWT_PUBLIC_KEY_BASE64: Buffer.from("not-a-key").toString("base64"),
        DATABASE_URL: "postgresql://user:password@localhost:5432/database",
      }),
    ).toThrow("Invalid environment configuration");
  });
});
