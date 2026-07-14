export type PayableStatus = "OPEN" | "PAID" | "CANCELED";

export type Payment = {
  amount: string;
  companyId: string;
  currencyCode: string;
  id: string;
  paidOn: string;
  payableId: string;
  recordedAt: string;
};

export type Reversal = {
  companyId: string;
  id: string;
  paymentId: string;
  reason: string;
  reversedAt: string;
};

export type PaymentHistory = Payment & { reversal: Reversal | null };

export type Payable = {
  activePayment: Payment | null;
  amount: string;
  cancellationReason: string | null;
  canceledAt: string | null;
  companyId: string;
  competenceDate: string;
  createdAt: string;
  currencyCode: string;
  description: string;
  documentNumber: string | null;
  dueDate: string;
  id: string;
  overdue: boolean;
  payeeName: string;
  payments: PaymentHistory[];
  status: PayableStatus;
  updatedAt: string;
  version: number;
};

export type Permissions = { canMutate: boolean };
export type PayableList = {
  items: Payable[];
  nextCursor: string | null;
  pageSize: number;
  permissions: Permissions;
};
export type PayableDetail = { payable: Payable; permissions: Permissions };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type RequestOptions = {
  body?: unknown;
  idempotencyKey?: string;
  method?: "GET" | "PATCH" | "POST";
};

export class SofiaApiClient {
  constructor(private readonly baseUrl = "/api/sofia") {}

  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          ...(options.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
          "X-Request-ID": crypto.randomUUID(),
        },
        method: options.method ?? "GET",
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "message" in payload &&
          typeof payload.message === "string"
            ? payload.message
            : "A API não conseguiu concluir a operação.";
        throw new ApiError(response.status, message);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError")
        throw new ApiError(0, "A API demorou demais para responder.");
      throw new ApiError(0, "Não foi possível conectar à API.");
    } finally {
      clearTimeout(timeout);
    }
  }

  list(companyId: string, params: URLSearchParams): Promise<PayableList> {
    const suffix = params.size ? `?${params.toString()}` : "";
    return this.request(
      `/api/v1/companies/${encodeURIComponent(companyId)}/payables${suffix}`,
    );
  }

  detail(companyId: string, payableId: string): Promise<PayableDetail> {
    return this.request(
      `/api/v1/companies/${encodeURIComponent(companyId)}/payables/${encodeURIComponent(payableId)}`,
    );
  }

  create(
    companyId: string,
    body: unknown,
    key: string,
  ): Promise<{ id: string }> {
    return this.request(
      `/api/v1/companies/${encodeURIComponent(companyId)}/payables`,
      { body, idempotencyKey: key, method: "POST" },
    );
  }

  update(
    companyId: string,
    payableId: string,
    body: unknown,
  ): Promise<Payable> {
    return this.request(
      `/api/v1/companies/${encodeURIComponent(companyId)}/payables/${encodeURIComponent(payableId)}`,
      { body, method: "PATCH" },
    );
  }

  pay(
    companyId: string,
    payableId: string,
    paidOn: string,
    key: string,
  ): Promise<unknown> {
    return this.request(
      `/api/v1/companies/${encodeURIComponent(companyId)}/payables/${encodeURIComponent(payableId)}/payments`,
      { body: { paidOn }, idempotencyKey: key, method: "POST" },
    );
  }

  reverse(
    companyId: string,
    payableId: string,
    paymentId: string,
    reason: string,
    key: string,
  ): Promise<unknown> {
    return this.request(
      `/api/v1/companies/${encodeURIComponent(companyId)}/payables/${encodeURIComponent(payableId)}/payments/${encodeURIComponent(paymentId)}/reversal`,
      { body: { reason }, idempotencyKey: key, method: "POST" },
    );
  }

  cancel(
    companyId: string,
    payableId: string,
    expectedVersion: number,
    reason: string,
  ): Promise<Payable> {
    return this.request(
      `/api/v1/companies/${encodeURIComponent(companyId)}/payables/${encodeURIComponent(payableId)}/cancellation`,
      { body: { expectedVersion, reason }, method: "POST" },
    );
  }
}

export function userMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Ocorreu um erro inesperado.";
  if (error.status === 0) return error.message;
  if (error.status === 401)
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (error.status === 403) return "Seu perfil não permite realizar esta ação.";
  if (error.status === 404)
    return "Empresa ou conta não encontrada, ou você não possui acesso.";
  if (error.status === 409 && error.message.toLowerCase().includes("version"))
    return "Esta conta foi alterada em outra sessão. Atualize os dados antes de tentar novamente.";
  if (error.status === 409)
    return "A operação entrou em conflito com o estado atual. Atualize a conta e tente novamente.";
  if (error.status === 400)
    return `Revise os dados informados. ${error.message}`;
  if (error.status >= 500)
    return "O serviço está temporariamente indisponível. Tente novamente em instantes.";
  return error.message;
}
