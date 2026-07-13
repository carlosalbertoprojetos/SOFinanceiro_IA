import { describe, expect, it } from "vitest";

import { validateEnvironment } from "./environment";

describe("validateEnvironment", () => {
  it("rejects configuration without DATABASE_URL", () => {
    expect(() => validateEnvironment({})).toThrow(
      "Invalid environment configuration",
    );
  });

  it("applies safe local defaults", () => {
    const environment = validateEnvironment({
      DATABASE_URL: "postgresql://user:password@localhost:5432/database",
    });

    expect(environment).toMatchObject({
      API_PORT: 3001,
      TZ: "America/Sao_Paulo",
      WEB_ORIGIN: "http://localhost:3000",
    });
  });
});
