import { z } from "zod";

const environmentSchema = z
  .object({
    API_PORT: z.coerce.number().int().positive().max(65535).default(3001),
    AUTH0_AUDIENCE: z.string().min(1).optional(),
    AUTH0_ISSUER: z.string().url().optional(),
    AUTH0_JWKS_CACHE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(600),
    AUTH0_JWKS_STALE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(3600),
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    TZ: z.string().min(1).default("America/Sao_Paulo"),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  })
  .refine(
    (value) => Boolean(value.AUTH0_AUDIENCE) === Boolean(value.AUTH0_ISSUER),
    "AUTH0_AUDIENCE and AUTH0_ISSUER must be configured together",
  )
  .refine(
    (value) =>
      !value.AUTH0_ISSUER ||
      value.NODE_ENV !== "production" ||
      new URL(value.AUTH0_ISSUER).protocol === "https:",
    "AUTH0_ISSUER must use HTTPS in production",
  )
  .refine(
    (value) =>
      value.AUTH0_JWKS_STALE_TTL_SECONDS >= value.AUTH0_JWKS_CACHE_TTL_SECONDS,
    "AUTH0_JWKS_STALE_TTL_SECONDS must be greater than or equal to cache TTL",
  );

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
