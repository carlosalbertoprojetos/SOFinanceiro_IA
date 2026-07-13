import { ConfigService } from "@nestjs/config";
import { exportSPKI, generateKeyPair, SignJWT, type KeyLike } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { JoseTokenVerifier } from "./jose-token-verifier";

const issuer = "https://auth.verifier.example.test";
const audience = "sofia-api";
const subject = "external-user-1";
let privateKey: KeyLike;
let verifier: JoseTokenVerifier;

type TokenOverrides = {
  audience?: string;
  expiresAt?: number;
  issuedAt?: number;
  issuer?: string;
  signingKey?: KeyLike;
};

async function issueToken(overrides: TokenOverrides = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(overrides.issuer ?? issuer)
    .setSubject(subject)
    .setAudience(overrides.audience ?? audience)
    .setIssuedAt(overrides.issuedAt ?? now)
    .setExpirationTime(overrides.expiresAt ?? now + 300)
    .sign(overrides.signingKey ?? privateKey);
}

describe("JoseTokenVerifier", () => {
  beforeAll(async () => {
    const keyPair = await generateKeyPair("RS256");
    privateKey = keyPair.privateKey;
    const publicKey = await exportSPKI(keyPair.publicKey);
    verifier = new JoseTokenVerifier(
      new ConfigService({
        AUTH_JWT_ALGORITHM: "RS256",
        AUTH_JWT_AUDIENCE: audience,
        AUTH_JWT_ISSUER: issuer,
        AUTH_JWT_PUBLIC_KEY_BASE64: Buffer.from(publicKey).toString("base64"),
      }),
    );
  });

  it("accepts a valid signed token and extracts only identity claims", async () => {
    await expect(verifier.verify(await issueToken())).resolves.toEqual({
      issuer,
      subject,
    });
  });

  it("rejects a token signed by another key", async () => {
    const otherKeyPair = await generateKeyPair("RS256");
    await expect(
      verifier.verify(
        await issueToken({ signingKey: otherKeyPair.privateKey }),
      ),
    ).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    await expect(
      verifier.verify(
        await issueToken({ expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      ),
    ).rejects.toThrow();
  });

  it("rejects an incorrect issuer", async () => {
    await expect(
      verifier.verify(
        await issueToken({ issuer: "https://wrong-issuer.example.test" }),
      ),
    ).rejects.toThrow();
  });

  it("rejects an incorrect audience", async () => {
    await expect(
      verifier.verify(await issueToken({ audience: "another-api" })),
    ).rejects.toThrow();
  });

  it("rejects an algorithm outside the allowlist", async () => {
    const keyPair = await generateKeyPair("PS256");
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "PS256" })
      .setIssuer(issuer)
      .setSubject(subject)
      .setAudience(audience)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(keyPair.privateKey);

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it("rejects a token issued in the future", async () => {
    await expect(
      verifier.verify(
        await issueToken({ issuedAt: Math.floor(Date.now() / 1000) + 60 }),
      ),
    ).rejects.toThrow("issued-at");
  });

  it("rejects a token without the required issued-at claim", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(issuer)
      .setSubject(subject)
      .setAudience(audience)
      .setExpirationTime(now + 300)
      .sign(privateKey);

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it("rejects a malformed token", async () => {
    await expect(verifier.verify("not-a-jwt")).rejects.toThrow();
  });
});
