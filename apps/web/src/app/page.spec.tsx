import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth0", () => ({
  getAuth0Client: () => ({ getSession: vi.fn(async () => null) }),
}));

import Home from "./page";

afterEach(cleanup);

describe("Home", () => {
  it("offers Auth0 login without rendering a token field", async () => {
    render(await Home());
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fcompanies",
    );
    expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument();
  });
});
