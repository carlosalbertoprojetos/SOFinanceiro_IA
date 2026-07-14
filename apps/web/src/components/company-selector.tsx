"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type CompanyAccess = {
  currencyCode: string;
  id: string;
  name: string;
  role: "ADMIN" | "MEMBER" | "OWNER";
  timezone: string;
};

type State =
  | { kind: "loading" }
  | { kind: "non-provisioned" }
  | { kind: "empty" }
  | { kind: "error" }
  | { companies: CompanyAccess[]; kind: "ready" };

function roleLabel(role: CompanyAccess["role"]): string {
  return { ADMIN: "Administrador", MEMBER: "Membro", OWNER: "Proprietário" }[
    role
  ];
}

export function CompanySelector({
  userName,
}: {
  userName: string;
}): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selecting, setSelecting] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    async function load(): Promise<void> {
      try {
        const response = await fetch("/api/sofia/api/v1/me/companies", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        if (
          response.status === 401 &&
          typeof body === "object" &&
          body !== null &&
          "code" in body &&
          body.code === "IDENTITY_NOT_PROVISIONED"
        ) {
          setState({ kind: "non-provisioned" });
          return;
        }
        if (!response.ok) throw new Error("companies unavailable");
        const companies = (body as { companies: CompanyAccess[] }).companies;
        setState(
          companies.length ? { companies, kind: "ready" } : { kind: "empty" },
        );
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ kind: "error" });
        }
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function select(company: CompanyAccess): Promise<void> {
    setSelecting(company.id);
    const response = await fetch("/api/preferences/company", {
      body: JSON.stringify({ companyId: company.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (response.ok)
      router.push(`/companies/${encodeURIComponent(company.id)}/payables`);
    else setState({ kind: "error" });
    setSelecting(undefined);
  }

  return (
    <main className="company-shell">
      <header className="app-header">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>SOFIA</span>
        </a>
        <span>{userName}</span>
        <a className="text-button" href="/auth/logout">
          Sair
        </a>
      </header>
      <section className="company-selection" aria-labelledby="company-title">
        <p className="section-label">Contexto de trabalho</p>
        <h1 id="company-title">Selecione uma empresa</h1>
        <p>
          A seleção orienta a navegação. O acesso será validado novamente em
          cada operação.
        </p>
        {state.kind === "loading" && (
          <p aria-live="polite" role="status">
            Carregando empresas…
          </p>
        )}
        {state.kind === "non-provisioned" && (
          <div className="state-message" role="status">
            <h2>Seu acesso ainda não foi provisionado</h2>
            <p>
              Peça ao administrador para vincular sua identidade Auth0 ao
              usuário autorizado no SOFIA.
            </p>
          </div>
        )}
        {state.kind === "empty" && (
          <div className="state-message" role="status">
            <h2>Você ainda não possui empresa associada</h2>
            <p>
              Um administrador precisa criar uma membership antes do primeiro
              acesso.
            </p>
          </div>
        )}
        {state.kind === "error" && (
          <p className="error-banner" role="alert">
            Não foi possível carregar suas empresas. Tente novamente.
          </p>
        )}
        {state.kind === "ready" && (
          <ul className="company-list">
            {state.companies.map((company) => (
              <li key={company.id}>
                <button
                  disabled={Boolean(selecting)}
                  onClick={() => void select(company)}
                >
                  <strong>{company.name}</strong>
                  <span>
                    {company.currencyCode} · {company.timezone} ·{" "}
                    {roleLabel(company.role)}
                  </span>
                  <span>
                    {selecting === company.id ? "Abrindo…" : "Acessar empresa"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
