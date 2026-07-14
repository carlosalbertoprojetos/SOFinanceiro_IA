"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { type Payable, SofiaApiClient, userMessage } from "../lib/api-client";

type Props = { companyId: string };
type Editor = "create" | "edit" | null;
type Action = "pay" | "reverse" | "cancel" | null;
type FormData = {
  amount: string;
  competenceDate: string;
  description: string;
  documentNumber: string;
  dueDate: string;
  payeeName: string;
};
const EMPTY_FORM: FormData = {
  amount: "",
  competenceDate: "",
  description: "",
  documentNumber: "",
  dueDate: "",
  payeeName: "",
};
const MONEY = /^(?!0+(?:\.0{1,2})?$)(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/;

function statusLabel(status: Payable["status"]): string {
  return { OPEN: "Em aberto", PAID: "Pago", CANCELED: "Cancelado" }[status];
}

function formatMoney(amount: string, currency: string): string {
  const [whole = "0", cents = "00"] = amount.split(".");
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents.padEnd(2, "0")}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function PayablesScreen({ companyId }: Props): React.JSX.Element {
  const [token, setToken] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [items, setItems] = useState<Payable[]>([]);
  const [selected, setSelected] = useState<Payable | null>(null);
  const [canMutate, setCanMutate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
  const [filters, setFilters] = useState({
    dueFrom: "",
    dueTo: "",
    overdue: "",
    query: "",
    sort: "due_asc",
    status: "",
  });
  const [editor, setEditor] = useState<Editor>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [action, setAction] = useState<Action>(null);
  const [actionValue, setActionValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logicalKey, setLogicalKey] = useState(() => crypto.randomUUID());
  const panelRef = useRef<HTMLElement>(null);
  const client = useMemo(
    () => (token ? new SofiaApiClient(token) : null),
    [token],
  );

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filters.query) params.set("query", filters.query);
    if (filters.status) params.set("status", filters.status);
    if (filters.dueFrom) params.set("dueFrom", filters.dueFrom);
    if (filters.dueTo) params.set("dueTo", filters.dueTo);
    if (filters.overdue) params.set("overdue", filters.overdue);
    params.set("sort", filters.sort);
    if (cursor) params.set("cursor", cursor);
    try {
      const result = await client.list(companyId, params);
      setItems(result.items);
      setNextCursor(result.nextCursor);
      setCanMutate(result.permissions.canMutate);
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [client, companyId, cursor, filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remote query synchronization
    void load();
  }, [load]);
  useEffect(() => {
    if (editor || action || selected) panelRef.current?.focus();
  }, [editor, action, selected]);

  async function openDetail(id: string): Promise<void> {
    if (!client) return;
    setLoading(true);
    setError("");
    try {
      const result = await client.detail(companyId, id);
      setSelected(result.payable);
      setCanMutate(result.permissions.canMutate);
      setEditor(null);
      setAction(null);
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!form.payeeName.trim()) errors.payeeName = "Informe o favorecido.";
    if (!form.description.trim()) errors.description = "Informe a descrição.";
    if (!MONEY.test(form.amount))
      errors.amount = "Use um valor positivo com até duas casas decimais.";
    if (!form.competenceDate) errors.competenceDate = "Informe a competência.";
    if (!form.dueDate) errors.dueDate = "Informe o vencimento.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!client || !validateForm() || submitting) return;
    setSubmitting(true);
    setError("");
    const body = { ...form, documentNumber: form.documentNumber || null };
    try {
      if (editor === "create") {
        const created = await client.create(companyId, body, logicalKey);
        setNotice("Conta criada com sucesso.");
        setEditor(null);
        setLogicalKey(crypto.randomUUID());
        await load();
        await openDetail(created.id);
      } else if (selected) {
        await client.update(companyId, selected.id, {
          ...body,
          expectedVersion: selected.version,
        });
        setNotice("Conta atualizada com sucesso.");
        setEditor(null);
        await load();
        await openDetail(selected.id);
      }
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  function startCreate(): void {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditor("create");
    setSelected(null);
    setAction(null);
    setLogicalKey(crypto.randomUUID());
  }
  function startEdit(): void {
    if (!selected) return;
    setForm({
      amount: selected.amount,
      competenceDate: selected.competenceDate,
      description: selected.description,
      documentNumber: selected.documentNumber ?? "",
      dueDate: selected.dueDate,
      payeeName: selected.payeeName,
    });
    setFormErrors({});
    setEditor("edit");
    setAction(null);
  }
  function startAction(next: Exclude<Action, null>): void {
    setAction(next);
    setEditor(null);
    setActionValue(next === "pay" ? new Date().toISOString().slice(0, 10) : "");
    setLogicalKey(crypto.randomUUID());
  }

  async function confirmAction(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!client || !selected || !actionValue.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      if (action === "pay")
        await client.pay(companyId, selected.id, actionValue, logicalKey);
      if (action === "reverse" && selected.activePayment)
        await client.reverse(
          companyId,
          selected.id,
          selected.activePayment.id,
          actionValue,
          logicalKey,
        );
      if (action === "cancel")
        await client.cancel(
          companyId,
          selected.id,
          selected.version,
          actionValue,
        );
      setNotice(
        action === "pay"
          ? "Pagamento registrado com sucesso."
          : action === "reverse"
            ? "Estorno registrado. O pagamento original foi preservado."
            : "Conta cancelada com sucesso.",
      );
      setAction(null);
      await load();
      await openDetail(selected.id);
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  if (!companyId)
    return (
      <main className="payables-shell">
        <div className="state-message">
          <h1>Selecione uma empresa</h1>
          <p>
            A rota precisa conter uma empresa para consultar contas a pagar.
          </p>
        </div>
      </main>
    );

  if (!token)
    return (
      <main className="auth-shell">
        <section className="access-panel" aria-labelledby="access-title">
          <div>
            <span className="brand-mark" aria-hidden="true">
              S
            </span>
            <p className="product-name">SOFIA</p>
          </div>
          <h1 id="access-title">Acesse as contas a pagar</h1>
          <p>
            Informe um token válido. Ele será mantido somente nesta aba e não
            será salvo pelo navegador.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (draftToken.trim()) setToken(draftToken.trim());
            }}
          >
            <label htmlFor="access-token">Token Bearer</label>
            <textarea
              id="access-token"
              value={draftToken}
              onChange={(event) => setDraftToken(event.target.value)}
              required
              rows={5}
              autoComplete="off"
            />
            <button className="primary-button" type="submit">
              Continuar com segurança
            </button>
          </form>
        </section>
      </main>
    );

  return (
    <main className="payables-shell">
      <header className="app-header">
        <a href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>SOFIA</span>
        </a>
        <div>
          <span className="company-context">Empresa selecionada</span>
          <code>{companyId}</code>
        </div>
        <button
          className="text-button"
          onClick={() => {
            setToken("");
            setItems([]);
          }}
        >
          Encerrar sessão
        </button>
      </header>
      <section className="page-heading">
        <div>
          <p className="section-label">Operação financeira</p>
          <h1>Contas a pagar</h1>
          <p>
            Consulte vencimentos e execute somente as ações permitidas para cada
            conta.
          </p>
        </div>
        {canMutate && (
          <button className="primary-button" onClick={startCreate}>
            Nova conta
          </button>
        )}
      </section>

      {notice && (
        <div className="feedback success" role="status">
          {notice}
          <button aria-label="Fechar mensagem" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="feedback error" role="alert">
          {error}
          <button aria-label="Fechar erro" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      <form
        className="filters"
        aria-label="Filtros de contas"
        onSubmit={(event) => {
          event.preventDefault();
          setCursor(null);
          setCursorHistory([]);
          void load();
        }}
      >
        <div className="field grow">
          <label htmlFor="filter-query">Buscar</label>
          <input
            id="filter-query"
            placeholder="Favorecido, descrição ou documento"
            value={filters.query}
            onChange={(event) =>
              setFilters({ ...filters, query: event.target.value })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
          >
            <option value="">Todos</option>
            <option value="OPEN">Em aberto</option>
            <option value="PAID">Pago</option>
            <option value="CANCELED">Cancelado</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-overdue">Vencimento</label>
          <select
            id="filter-overdue"
            value={filters.overdue}
            onChange={(event) =>
              setFilters({ ...filters, overdue: event.target.value })
            }
          >
            <option value="">Todos</option>
            <option value="true">Somente vencidas</option>
            <option value="false">Não vencidas</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-due-from">Vence a partir de</label>
          <input
            id="filter-due-from"
            type="date"
            value={filters.dueFrom}
            onChange={(event) =>
              setFilters({ ...filters, dueFrom: event.target.value })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="filter-due-to">Vence até</label>
          <input
            id="filter-due-to"
            type="date"
            value={filters.dueTo}
            onChange={(event) =>
              setFilters({ ...filters, dueTo: event.target.value })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="filter-sort">Ordenar</label>
          <select
            id="filter-sort"
            value={filters.sort}
            onChange={(event) =>
              setFilters({ ...filters, sort: event.target.value })
            }
          >
            <option value="due_asc">Vencimento próximo</option>
            <option value="due_desc">Vencimento distante</option>
            <option value="created_desc">Criação recente</option>
          </select>
        </div>
        <button className="secondary-button" type="submit">
          Aplicar filtros
        </button>
      </form>

      <section className="workspace">
        <div className="list-region" aria-busy={loading}>
          {loading && (
            <div
              className="skeleton-list"
              role="status"
              aria-label="Carregando contas"
            >
              <span />
              <span />
              <span />
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="state-message">
              <h2>Nenhuma conta encontrada</h2>
              <p>Ajuste os filtros ou crie a primeira conta desta empresa.</p>
              {canMutate && (
                <button className="secondary-button" onClick={startCreate}>
                  Criar conta
                </button>
              )}
            </div>
          )}
          {!loading && items.length > 0 && (
            <ul className="payable-list">
              {items.map((payable) => (
                <li key={payable.id}>
                  <button
                    className={`payable-row ${selected?.id === payable.id ? "selected" : ""}`}
                    onClick={() => void openDetail(payable.id)}
                  >
                    <span className="row-main">
                      <strong>{payable.payeeName}</strong>
                      <span>{payable.description}</span>
                    </span>
                    <span className="row-date">
                      <small>Vencimento</small>
                      <strong>{formatDate(payable.dueDate)}</strong>
                      {payable.overdue && <em>Vencida</em>}
                    </span>
                    <span className="row-amount">
                      <strong>
                        {formatMoney(payable.amount, payable.currencyCode)}
                      </strong>
                      <span
                        className={`status status-${payable.status.toLowerCase()}`}
                      >
                        {statusLabel(payable.status)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <nav className="pagination" aria-label="Paginação">
            <button
              className="text-button"
              disabled={!cursorHistory.length}
              onClick={() => {
                const history = [...cursorHistory];
                setCursor(history.pop() ?? null);
                setCursorHistory(history);
              }}
            >
              Anterior
            </button>
            <button
              className="text-button"
              disabled={!nextCursor}
              onClick={() => {
                setCursorHistory([...cursorHistory, cursor]);
                setCursor(nextCursor);
              }}
            >
              Próxima
            </button>
          </nav>
        </div>

        <aside
          className="detail-panel"
          ref={panelRef}
          tabIndex={-1}
          aria-label={editor ? "Formulário da conta" : "Detalhes da conta"}
        >
          {editor && (
            <PayableForm
              form={form}
              errors={formErrors}
              editing={editor === "edit"}
              submitting={submitting}
              onChange={setForm}
              onCancel={() => setEditor(null)}
              onSubmit={save}
            />
          )}
          {!editor && !selected && (
            <div className="detail-placeholder">
              <h2>Detalhes da conta</h2>
              <p>
                Selecione uma conta para ver pagamento, histórico e ações
                disponíveis.
              </p>
            </div>
          )}
          {!editor && selected && (
            <>
              <div className="detail-title">
                <div>
                  <span
                    className={`status status-${selected.status.toLowerCase()}`}
                  >
                    {statusLabel(selected.status)}
                  </span>
                  {selected.overdue && (
                    <span className="overdue-text">Vencida</span>
                  )}
                  <h2>{selected.payeeName}</h2>
                  <p>{selected.description}</p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Fechar detalhes"
                  onClick={() => {
                    setSelected(null);
                    setAction(null);
                  }}
                >
                  ×
                </button>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>Valor</dt>
                  <dd>{formatMoney(selected.amount, selected.currencyCode)}</dd>
                </div>
                <div>
                  <dt>Vencimento</dt>
                  <dd>{formatDate(selected.dueDate)}</dd>
                </div>
                <div>
                  <dt>Competência</dt>
                  <dd>{formatDate(selected.competenceDate)}</dd>
                </div>
                <div>
                  <dt>Documento</dt>
                  <dd>{selected.documentNumber || "Não informado"}</dd>
                </div>
              </dl>
              {selected.activePayment && (
                <section className="history-block">
                  <h3>Pagamento ativo</h3>
                  <p>
                    {formatMoney(
                      selected.activePayment.amount,
                      selected.activePayment.currencyCode,
                    )}{" "}
                    em {formatDate(selected.activePayment.paidOn)}
                  </p>
                </section>
              )}
              {selected.payments.some((payment) => payment.reversal) && (
                <section className="history-block">
                  <h3>Histórico preservado</h3>
                  {selected.payments
                    .filter((payment) => payment.reversal)
                    .map((payment) => (
                      <p key={payment.id}>
                        Pagamento de {formatDate(payment.paidOn)} — estornado:{" "}
                        {payment.reversal?.reason}
                      </p>
                    ))}
                </section>
              )}
              {selected.status === "CANCELED" && (
                <section className="history-block">
                  <h3>Cancelamento</h3>
                  <p>{selected.cancellationReason}</p>
                </section>
              )}
              {canMutate && !action && (
                <div className="actions">
                  {selected.status === "OPEN" && (
                    <>
                      <button className="secondary-button" onClick={startEdit}>
                        Editar
                      </button>
                      <button
                        className="primary-button"
                        onClick={() => startAction("pay")}
                      >
                        Registrar pagamento
                      </button>
                      <button
                        className="danger-text-button"
                        onClick={() => startAction("cancel")}
                      >
                        Cancelar conta
                      </button>
                    </>
                  )}
                  {selected.status === "PAID" && selected.activePayment && (
                    <button
                      className="danger-text-button"
                      onClick={() => startAction("reverse")}
                    >
                      Estornar pagamento
                    </button>
                  )}
                </div>
              )}
              {action && (
                <form className="confirmation" onSubmit={confirmAction}>
                  <h3>
                    {action === "pay"
                      ? "Confirmar pagamento"
                      : action === "reverse"
                        ? "Confirmar estorno"
                        : "Confirmar cancelamento"}
                  </h3>
                  <p>
                    {action === "pay"
                      ? "O servidor usará o valor integral da conta."
                      : action === "reverse"
                        ? "O pagamento original continuará no histórico."
                        : "A conta continuará consultável e não poderá ser paga."}
                  </p>
                  <label htmlFor="action-value">
                    {action === "pay"
                      ? "Data efetiva do pagamento"
                      : "Justificativa"}
                  </label>
                  {action === "pay" ? (
                    <input
                      id="action-value"
                      type="date"
                      value={actionValue}
                      onChange={(event) => setActionValue(event.target.value)}
                      required
                    />
                  ) : (
                    <textarea
                      id="action-value"
                      value={actionValue}
                      onChange={(event) => setActionValue(event.target.value)}
                      required
                      rows={3}
                      maxLength={500}
                    />
                  )}
                  <div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setAction(null)}
                    >
                      Voltar
                    </button>
                    <button
                      className={
                        action === "pay" ? "primary-button" : "danger-button"
                      }
                      disabled={submitting}
                      type="submit"
                    >
                      {submitting ? "Processando…" : "Confirmar operação"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}

function PayableForm({
  form,
  errors,
  editing,
  submitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: FormData;
  errors: Record<string, string>;
  editing: boolean;
  submitting: boolean;
  onChange: (form: FormData) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}): React.JSX.Element {
  const field = (
    name: keyof FormData,
    label: string,
    type = "text",
    optional = false,
  ) => (
    <div className="field">
      <label htmlFor={`payable-${name}`}>
        {label}
        {optional && <span> (opcional)</span>}
      </label>
      <input
        id={`payable-${name}`}
        type={type}
        value={form[name]}
        onChange={(event) => onChange({ ...form, [name]: event.target.value })}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `error-${name}` : undefined}
        required={!optional}
      />
      {errors[name] && (
        <small className="field-error" id={`error-${name}`}>
          {errors[name]}
        </small>
      )}
    </div>
  );
  return (
    <form className="editor-form" noValidate onSubmit={onSubmit}>
      <div>
        <p className="section-label">
          {editing ? "Atualização" : "Novo registro"}
        </p>
        <h2>{editing ? "Editar conta aberta" : "Nova conta a pagar"}</h2>
        <p>A moeda será definida pela empresa.</p>
      </div>
      {field("payeeName", "Favorecido")}
      {field("description", "Descrição")}
      {field("documentNumber", "Número do documento", "text", true)}
      {field("amount", "Valor", "text")}
      {field("competenceDate", "Competência", "date")}
      {field("dueDate", "Vencimento", "date")}
      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button" disabled={submitting} type="submit">
          {submitting
            ? "Salvando…"
            : editing
              ? "Salvar alterações"
              : "Criar conta"}
        </button>
      </div>
    </form>
  );
}
