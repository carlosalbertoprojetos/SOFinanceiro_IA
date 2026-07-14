import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getAuth0Client } from "../lib/auth0";

export default async function Home(): Promise<React.JSX.Element> {
  const session = await getAuth0Client().getSession();
  if (session) {
    const activeCompany = (await cookies()).get("sofia_active_company")?.value;
    redirect(
      activeCompany
        ? `/companies/${encodeURIComponent(activeCompany)}/payables`
        : "/companies",
    );
  }

  return (
    <main className="auth-shell">
      <section className="access-panel" aria-labelledby="login-title">
        <div>
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <p className="product-name">SOFIA</p>
        </div>
        <h1 id="login-title">Controle financeiro começa com acesso seguro</h1>
        <p>
          Entre para consultar somente as empresas associadas ao seu usuário.
        </p>
        <a className="primary-button" href="/auth/login?returnTo=%2Fcompanies">
          Entrar
        </a>
      </section>
    </main>
  );
}
