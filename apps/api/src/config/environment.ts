import { z } from "zod";

function isBase64EncodedPublicKey(value: string): boolean {
  try {
    const publicKey = Buffer.from(value, "base64").toString("utf8");
    return (
      publicKey.startsWith("-----BEGIN PUBLIC KEY-----") &&
      publicKey.trimEnd().endsWith("-----END PUBLIC KEY-----")
    );
  } catch {
    return false;
  }
}

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().positive().max(65535).default(3001),
  AUTH_JWT_ALGORITHM: z.literal("RS256").default("RS256"),
  AUTH_JWT_AUDIENCE: z.string().min(1),
  AUTH_JWT_ISSUER: z.string().url(),
  AUTH_JWT_PUBLIC_KEY_BASE64: z
    .string()
    .min(1)
    .refine(isBase64EncodedPublicKey, "must encode a PEM public key"),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  TZ: z.string().min(1).default("America/Sao_Paulo"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  values: Record<string, unknown>,
): Environment {
  const result = environmentSchema.safeParse(values);

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration: ${result.error.message}`,
    );
  }

  return result.data;
}
