const DEFAULT_RETURN_TO = "/companies";

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_RETURN_TO;
  }
  try {
    const parsed = new URL(value, "https://sofia.local");
    return parsed.origin === "https://sofia.local"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : DEFAULT_RETURN_TO;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}
