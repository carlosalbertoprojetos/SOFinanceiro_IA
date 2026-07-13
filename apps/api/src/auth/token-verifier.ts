export const TOKEN_VERIFIER = Symbol("TOKEN_VERIFIER");

export type VerifiedTokenIdentity = {
  issuer: string;
  subject: string;
};

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedTokenIdentity>;
}
