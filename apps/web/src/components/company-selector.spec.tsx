import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CompanySelector } from "./company-selector";

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

describe("CompanySelector", () => {
  it("shows the explicit non-provisioned state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ code: "IDENTITY_NOT_PROVISIONED" }, { status: 401 }),
      ),
    );
    render(<CompanySelector userName="Ana" />);
    expect(
      await screen.findByText("Seu acesso ainda não foi provisionado"),
    ).toBeInTheDocument();
  });

  it("shows the no-company state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ companies: [] })),
    );
    render(<CompanySelector userName="Ana" />);
    expect(
      await screen.findByText("Você ainda não possui empresa associada"),
    ).toBeInTheDocument();
  });

  it("selects only a company returned by the authenticated endpoint", async () => {
    const company = {
      currencyCode: "BRL",
      id: "company-own",
      name: "Empresa própria",
      role: "OWNER",
      timezone: "America/Sao_Paulo",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ companies: [company] }))
      .mockResolvedValueOnce(Response.json({ selected: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CompanySelector userName="Ana" />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Empresa própria/ }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/preferences/company",
      expect.objectContaining({
        body: JSON.stringify({ companyId: company.id }),
      }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/companies/company-own/payables"),
    );
  });
});
