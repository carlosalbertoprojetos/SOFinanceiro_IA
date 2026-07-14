export default function AuthenticationErrorPage(): React.JSX.Element {
  return (
    <main className="auth-shell">
      <section className="access-panel" aria-labelledby="auth-error-title">
        <p className="product-name">SOFIA</p>
        <h1 id="auth-error-title">Não foi possível concluir a autenticação</h1>
        <p>
          Revise o acesso no Auth0 ou tente novamente. Nenhum dado financeiro
          foi alterado.
        </p>
        <a className="primary-button" href="/auth/login?returnTo=%2Fcompanies">
          Tentar novamente
        </a>
      </section>
    </main>
  );
}
