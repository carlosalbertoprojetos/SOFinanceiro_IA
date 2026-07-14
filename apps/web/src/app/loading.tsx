export default function Loading(): React.JSX.Element {
  return (
    <main className="auth-shell">
      <p aria-live="polite" role="status">
        Autenticando…
      </p>
    </main>
  );
}
