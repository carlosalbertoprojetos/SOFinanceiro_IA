import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPublicKey, type KeyObject } from "node:crypto";
import { jwtVerify } from "jose";

import type { TokenVerifier, VerifiedTokenIdentity } from "./token-verifier";

@Injectable()
export class JoseTokenVerifier implements TokenVerifier {
  private readonly algorithm: "RS256";
  private readonly audience: string;
  private readonly issuer: string;
  private readonly publicKey: KeyObject;

  constructor(configService: ConfigService) {
    this.algorithm = configService.getOrThrow<"RS256">("AUTH_JWT_ALGORITHM");
    this.audience = configService.getOrThrow<string>("AUTH_JWT_AUDIENCE");
    this.issuer = configService.getOrThrow<string>("AUTH_JWT_ISSUER");

    const encodedPublicKey = configService.getOrThrow<string>(
      "AUTH_JWT_PUBLIC_KEY_BASE64",
    );
    this.publicKey = createPublicKey(
      Buffer.from(encodedPublicKey, "base64").toString("utf8"),
    );

    if (this.publicKey.asymmetricKeyType !== "rsa") {
      throw new Error("AUTH_JWT_PUBLIC_KEY_BASE64 must contain an RSA key");
    }
  }

  async verify(token: string): Promise<VerifiedTokenIdentity> {
    const { payload, protectedHeader } = await jwtVerify(
      token,
      this.publicKey,
      {
        algorithms: [this.algorithm],
        audience: this.audience,
        issuer: this.issuer,
        requiredClaims: ["iss", "sub", "aud", "exp", "iat"],
      },
    );

    if (protectedHeader.alg !== this.algorithm) {
      throw new Error("JWT algorithm is not allowed");
    }

    if (
      typeof payload.iat !== "number" ||
      payload.iat > Math.floor(Date.now() / 1000)
    ) {
      throw new Error("JWT issued-at claim is invalid");
    }

    if (
      typeof payload.iss !== "string" ||
      payload.iss.length === 0 ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0
    ) {
      throw new Error("JWT identity claims are invalid");
    }

    return {
      issuer: payload.iss,
      subject: payload.sub,
    };
  }
}
