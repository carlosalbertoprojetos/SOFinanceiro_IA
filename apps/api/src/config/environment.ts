import { z } from "zod";

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().positive().max(65535).default(3001),
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
