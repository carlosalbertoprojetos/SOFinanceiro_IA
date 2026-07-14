import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccessToken } = vi.hoisted(() => ({ getAccessToken: vi.fn() }));
vi.mock("../../../../lib/auth0", () => ({
  getAuth0Client: () => ({ getAccessToken }),
}));

import { GET, POST } from "./route";

const context = {
  params: Promise.resolve({ path: ["api", "v1", "me", "companies"] }),
};

beforeEach(() => {
  getAccessToken.mockReset();
  vi.unstubAllGlobals();
});

describe("SOFIA BFF", () => {
  it("keeps the access token server-side", async () => {
    getAccessToken.mockResolvedValue({ token: "server-access-token" });
    const backend = vi.fn(async (_input: URL, init: RequestInit) => {
      expect(new Headers(init.headers).get("Authorization")).toBe(
        "Bearer server-access-token",
      );
      return Response.json({ companies: [] });
    });
    vi.stubGlobal("fetch", backend);

    const response = await GET(
      new NextRequest("http://localhost/api/sofia/api/v1/me/companies"),
      context,
    );
    expect(await response.json()).toEqual({ companies: [] });
    expect(response.headers.get("Authorization")).toBeNull();
  });

  it("returns a recoverable 401 when renewal or session restoration fails", async () => {
    getAccessToken.mockRejectedValue(new Error("refresh failed"));
    const response = await GET(
      new NextRequest("http://localhost/api/sofia/api/v1/me/companies"),
      context,
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });

  it("blocks cross-origin mutation before reading the session", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/sofia/api/v1/me/companies", {
        headers: { Origin: "https://attacker.example" },
        method: "POST",
      }),
      context,
    );
    expect(response.status).toBe(403);
    expect(getAccessToken).not.toHaveBeenCalled();
  });
});
