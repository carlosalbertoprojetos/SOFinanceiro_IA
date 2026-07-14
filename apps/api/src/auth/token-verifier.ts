export const TOKEN_VERIFIER = Symbol("TOKEN_VERIFIER");

export type VerifiedTokenIdentity = {
  issuer: string;
  subject: string;
};

export type TokenVerifierReadiness = {
  configured: boolean;
  reason?: string;
};

export interface TokenVerifier {
  readiness(): TokenVerifierReadiness;
  verify(token: string): Promise<VerifiedTokenIdentity>;
}
