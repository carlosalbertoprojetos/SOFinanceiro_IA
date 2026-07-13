import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("shows a loading state while checking the backend", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );

    render(<Home />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Verificando o backend",
    );
  });

  it("shows when the backend is available", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ service: "api", status: "ok" }),
      ok: true,
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(await screen.findByText("Backend disponível")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/health",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("shows when the backend is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );

    render(<Home />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend indisponível",
    );
  });
});
