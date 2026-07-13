"use client";

import { useEffect, useState } from "react";

type BackendStatus = "available" | "loading" | "unavailable";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function isHealthyResponse(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const response = value as Record<string, unknown>;
  return response.status === "ok" && response.service === "api";
}

export default function Home(): React.JSX.Element {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function checkBackend(): Promise<void> {
      try {
        const response = await fetch(`${apiUrl}/health`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json();

        setBackendStatus(
          response.ok && isHealthyResponse(body) ? "available" : "unavailable",
        );
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setBackendStatus("unavailable");
      }
    }

    void checkBackend();

    return () => controller.abort();
  }, []);

  return (
    <main>
      <section aria-labelledby="page-title" className="status-card">
        <p className="eyebrow">SOFIA</p>
        <h1 id="page-title">Sistema Operacional Financeiro</h1>
        <p>A fundação do sistema está ativa.</p>

        {backendStatus === "loading" && (
          <p aria-live="polite" className="status loading" role="status">
            Verificando o backend…
          </p>
        )}

        {backendStatus === "available" && (
          <p aria-live="polite" className="status available" role="status">
            Backend disponível
          </p>
        )}

        {backendStatus === "unavailable" && (
          <p aria-live="assertive" className="status unavailable" role="alert">
            Backend indisponível. Verifique a API e o PostgreSQL.
          </p>
        )}
      </section>
    </main>
  );
}
