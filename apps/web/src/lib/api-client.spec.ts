import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, SofiaApiClient, userMessage } from "./api-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SofiaApiClient", () => {
  it("uses the same-origin BFF without exposing a bearer token", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ items: [] }),
      ok: true,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new SofiaApiClient("/api/sofia");

    await client.list("company-1", new URLSearchParams("status=OPEN"));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sofia/api/v1/companies/company-1/payables?status=OPEN",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      }),
    );
  });

  it("keeps the supplied idempotency key on create", async () => {
    const fetchMock = vi.fn(async () => ({ json: async () => ({}), ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new SofiaApiClient("/api/sofia");

    await client.create("company", { amount: "10.00" }, "logical-attempt");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "logical-attempt",
        }),
      }),
    );
  });

  it.each([
    [401, "sessão"],
    [403, "perfil"],
    [404, "não encontrada"],
    [409, "conflito"],
    [503, "indisponível"],
  ])("maps HTTP %s to an actionable message", (status, expected) => {
    expect(userMessage(new ApiError(status, "failure"))).toMatch(
      new RegExp(expected, "i"),
    );
  });

  it("maps a version conflict without hiding concurrent change", () => {
    expect(
      userMessage(new ApiError(409, "Payable version conflict")),
    ).toContain("alterada em outra sessão");
  });

  it("normalizes network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    const client = new SofiaApiClient("/api/sofia");

    await expect(
      client.list("company", new URLSearchParams()),
    ).rejects.toMatchObject({
      message: "Não foi possível conectar à API.",
      status: 0,
    });
  });
});
