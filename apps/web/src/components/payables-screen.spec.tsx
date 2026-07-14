import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PayablesScreen } from "./payables-screen";

const payable = {
  activePayment: null,
  amount: "1250.50",
  cancellationReason: null,
  canceledAt: null,
  companyId: "company-1",
  competenceDate: "2026-07-01",
  createdAt: "2026-07-01T12:00:00.000Z",
  currencyCode: "BRL",
  description: "Serviço mensal",
  documentNumber: "NF-10",
  dueDate: "2026-07-10",
  id: "payable-1",
  overdue: true,
  payeeName: "Fornecedor Alfa",
  payments: [],
  status: "OPEN",
  updatedAt: "2026-07-01T12:00:00.000Z",
  version: 1,
};

function response(body: unknown, ok = true, status = 200) {
  return { json: async () => body, ok, status };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PayablesScreen", () => {
  it("does not render or request a manual token", () => {
    render(<PayablesScreen companyId="company-1" />);
    expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument();
  });

  it("shows loading and then an educational empty state", async () => {
    let resolveFetch!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    render(<PayablesScreen companyId="company-1" />);
    expect(screen.getByLabelText("Carregando contas")).toBeInTheDocument();
    resolveFetch(
      response({
        items: [],
        nextCursor: null,
        pageSize: 20,
        permissions: { canMutate: true },
      }),
    );
    expect(
      await screen.findByText("Nenhuma conta encontrada"),
    ).toBeInTheDocument();
  });

  it("renders financial fields and overdue text without relying on color", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          items: [payable],
          nextCursor: null,
          pageSize: 20,
          permissions: { canMutate: true },
        }),
      ),
    );
    render(<PayablesScreen companyId="company-1" />);
    expect(await screen.findByText("Fornecedor Alfa")).toBeInTheDocument();
    expect(screen.getByText("BRL 1.250,50")).toBeInTheDocument();
    expect(screen.getByText("Vencida")).toBeInTheDocument();
    expect(screen.getAllByText("Em aberto")).toHaveLength(2);
  });

  it("keeps MEMBER read-only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          items: [payable],
          nextCursor: null,
          pageSize: 20,
          permissions: { canMutate: false },
        }),
      ),
    );
    render(<PayablesScreen companyId="company-1" />);
    await screen.findByText("Fornecedor Alfa");
    expect(
      screen.queryByRole("button", { name: "Nova conta" }),
    ).not.toBeInTheDocument();
  });

  it("validates money as a decimal string before creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          items: [],
          nextCursor: null,
          pageSize: 20,
          permissions: { canMutate: true },
        }),
      ),
    );
    render(<PayablesScreen companyId="company-1" />);
    await screen.findByText("Nenhuma conta encontrada");
    fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));
    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "10.999" },
    });
    fireEvent.click(
      within(screen.getByLabelText("Formulário da conta")).getByRole("button", {
        name: "Criar conta",
      }),
    );
    expect(
      await screen.findByText(/até duas casas decimais/i),
    ).toBeInTheDocument();
  });

  it("shows authentication recovery for HTTP 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ message: "Unauthorized" }, false, 401)),
    );
    render(<PayablesScreen companyId="company-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "sessão expirou",
    );
    expect(
      screen.getByRole("link", { name: "Entrar novamente" }),
    ).toHaveAttribute("href", expect.stringContaining("/auth/login?returnTo="));
  });

  it("offers company reselection when the active membership was revoked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ message: "Not found" }, false, 404)),
    );
    render(<PayablesScreen companyId="company-removed" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "não possui acesso",
    );
    expect(
      screen.getByRole("link", { name: "Selecionar outra empresa" }),
    ).toHaveAttribute("href", "/companies");
  });

  it("supports stable next-page navigation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          items: [payable],
          nextCursor: "opaque",
          pageSize: 20,
          permissions: { canMutate: false },
        }),
      )
      .mockResolvedValueOnce(
        response({
          items: [],
          nextCursor: null,
          pageSize: 20,
          permissions: { canMutate: false },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<PayablesScreen companyId="company-1" />);
    await screen.findByText("Fornecedor Alfa");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining("cursor=opaque"),
        expect.any(Object),
      ),
    );
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("loads detail and explains an edit version conflict", async () => {
    const fetchMock = vi.fn(async (input: string, options: RequestInit) => {
      if (options.method === "PATCH") {
        return response({ message: "Payable version conflict" }, false, 409);
      }
      if (input.endsWith("/payable-1")) {
        return response({ payable, permissions: { canMutate: true } });
      }
      return response({
        items: [payable],
        nextCursor: null,
        pageSize: 20,
        permissions: { canMutate: true },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PayablesScreen companyId="company-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Fornecedor Alfa/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "alterada em outra sessão",
    );
  });

  it("confirms payment without requesting a client amount", async () => {
    const fetchMock = vi.fn(async (input: string, options: RequestInit) => {
      if (options.method === "POST" && input.endsWith("/payments")) {
        return response({});
      }
      if (input.endsWith("/payable-1")) {
        return response({ payable, permissions: { canMutate: true } });
      }
      return response({
        items: [payable],
        nextCursor: null,
        pageSize: 20,
        permissions: { canMutate: true },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PayablesScreen companyId="company-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Fornecedor Alfa/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Registrar pagamento" }),
    );
    expect(
      screen.getByLabelText("Data efetiva do pagamento"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Valor")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    expect(
      await screen.findByText("Pagamento registrado com sucesso."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/payments$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  it("offers reversal for paid state and preserves its explanation", async () => {
    const activePayment = {
      amount: "1250.50",
      companyId: "company-1",
      currencyCode: "BRL",
      id: "payment-1",
      paidOn: "2026-07-10",
      payableId: "payable-1",
      recordedAt: "2026-07-10T12:00:00.000Z",
    };
    const paid = {
      ...payable,
      activePayment,
      overdue: false,
      payments: [{ ...activePayment, reversal: null }],
      status: "PAID",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        input.endsWith("/payable-1")
          ? response({ payable: paid, permissions: { canMutate: true } })
          : response({
              items: [paid],
              nextCursor: null,
              pageSize: 20,
              permissions: { canMutate: true },
            }),
      ),
    );
    render(<PayablesScreen companyId="company-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Fornecedor Alfa/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Estornar pagamento" }),
    );
    expect(
      screen.getByText(/pagamento original continuará/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Justificativa")).toBeInTheDocument();
  });
});
