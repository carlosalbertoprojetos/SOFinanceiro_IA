import { ConfigService } from "@nestjs/config";
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
  type KeyLike,
} from "jose";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { JoseTokenVerifier } from "./jose-token-verifier";

const issuer = "https://auth.verifier.example.test/";
const audience = "https://api.sofia.local";
const subject = "auth0|external-user-1";
let key1: { privateKey: KeyLike; publicJwk: JWK };
let key2: { privateKey: KeyLike; publicJwk: JWK };
let currentJwks: { keys: JWK[] };
let unavailable: boolean;
let discoveryRequests: number;
let jwksRequests: number;

type TokenOverrides = {
  algorithm?: "PS256" | "RS256";
  audience?: string;
  expiresAt?: number;
  issuedAt?: number;
  issuer?: string;
  key?: typeof key1;
  kid?: string;
};

async function makeKey(kid: string): Promise<typeof key1> {
  const pair = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(pair.publicKey);
  return { privateKey: pair.privateKey, publicJwk: { ...publicJwk, kid } };
}

async function issueToken(overrides: TokenOverrides = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const key = overrides.key ?? key1;
  return new SignJWT({})
    .setProtectedHeader({
      alg: overrides.algorithm ?? "RS256",
      kid: overrides.kid ?? key.publicJwk.kid,
      typ: "JWT",
    })
    .setIssuer(overrides.issuer ?? issuer)
    .setSubject(subject)
    .setAudience(overrides.audience ?? audience)
    .setIssuedAt(overrides.issuedAt ?? now)
    .setExpirationTime(overrides.expiresAt ?? now + 300)
    .sign(key.privateKey);
}

const fetcher = vi.fn(async (input: string | URL | Request) => {
  const url = input.toString();
  if (url.endsWith("/.well-known/openid-configuration")) {
    discoveryRequests += 1;
    return Response.json({
      issuer,
      jwks_uri: `${issuer}.well-known/jwks.json`,
    });
  }
  jwksRequests += 1;
  if (unavailable) throw new Error("network unavailable");
  return Response.json(currentJwks);
});

function createVerifier(cacheSeconds = 600): JoseTokenVerifier {
  return new JoseTokenVerifier(
    new ConfigService({
      AUTH0_AUDIENCE: audience,
      AUTH0_ISSUER: issuer,
      AUTH0_JWKS_CACHE_TTL_SECONDS: cacheSeconds,
      AUTH0_JWKS_STALE_TTL_SECONDS: 60,
    }),
    fetcher as typeof fetch,
  );
}

describe("JoseTokenVerifier OIDC/JWKS", () => {
  beforeAll(async () => {
    key1 = await makeKey("key-1");
    key2 = await makeKey("key-2");
  });

  beforeEach(() => {
    currentJwks = { keys: [key1.publicJwk] };
    discoveryRequests = 0;
    jwksRequests = 0;
    unavailable = false;
    fetcher.mockClear();
    vi.useRealTimers();
  });

  it("accepts a valid access token and caches discovery and keys", async () => {
    const verifier = createVerifier();
    await expect(verifier.verify(await issueToken())).resolves.toEqual({
      issuer,
      subject,
    });
    await expect(verifier.verify(await issueToken())).resolves.toEqual({
      issuer,
      subject,
    });
    expect({ discoveryRequests, jwksRequests }).toEqual({
      discoveryRequests: 1,
      jwksRequests: 1,
    });
  });

  it.each([
    ["issuer", { issuer: "https://wrong.example.test/" }],
    ["audience", { audience: "another-api" }],
    ["expired", { expiresAt: 1 }],
  ])("rejects a token with invalid %s", async (_name, overrides) => {
    await expect(
      createVerifier().verify(await issueToken(overrides)),
    ).rejects.toThrow();
  });

  it("rejects an invalid signature", async () => {
    await expect(
      createVerifier().verify(await issueToken({ key: key2, kid: "key-1" })),
    ).rejects.toThrow();
  });

  it("rejects malformed, unknown-key and disallowed-algorithm tokens", async () => {
    const verifier = createVerifier();
    await expect(verifier.verify("not-a-jwt")).rejects.toThrow();
    await expect(
      verifier.verify(await issueToken({ kid: "unknown" })),
    ).rejects.toThrow();
    await expect(
      verifier.verify(await issueToken({ algorithm: "PS256" })),
    ).rejects.toThrow("algorithm");
  });

  it("refreshes JWKS when a rotated kid is received", async () => {
    const verifier = createVerifier();
    await verifier.verify(await issueToken());
    currentJwks = { keys: [key2.publicJwk] };
    await expect(
      verifier.verify(await issueToken({ key: key2 })),
    ).resolves.toEqual({ issuer, subject });
    expect(jwksRequests).toBe(2);
  });

  it("fails closed when JWKS is unavailable without cache", async () => {
    unavailable = true;
    await expect(createVerifier().verify(await issueToken())).rejects.toThrow(
      "network unavailable",
    );
  });

  it("uses a still-trusted stale key when JWKS is temporarily unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T20:00:00Z"));
    const verifier = createVerifier(1);
    await verifier.verify(await issueToken());
    vi.advanceTimersByTime(1_100);
    unavailable = true;
    await expect(verifier.verify(await issueToken())).resolves.toEqual({
      issuer,
      subject,
    });
    expect(jwksRequests).toBe(2);
  });
});
