import { useEffect, useState, type FormEvent } from "react";
import ImprovementPlanComparison from "./ImprovementPlanComparison";
import { apiPath, errorMessage, request } from "./improvement-plans-api";
import { useViewFocus } from "./use-view-focus";

type Role = "ADMIN" | "COORDINATOR" | "PROFESSOR";
type Status = "PENDING" | "IN_PROGRESS" | "COMPLETED";
type Option = { id: string; name: string };
type Discipline = Option & { code: string };
type Assignee = Option & { role: Role };

type Plan = {
  id: string;
  discipline: Discipline;
  problem: string;
  action: string;
  assignee: Assignee;
  dueDate: string;
  status: Status;
  createdAt: string;
  originPeriod: Option | null;
  originEvaluation: { id: string; classCode: string } | null;
};

type PlanDetail = Plan & {
  history: {
    id: number;
    previousStatus: Status | null;
    status: Status;
    changedAt: string;
    author: { name: string };
  }[];
};

type Evaluation = {
  id: string;
  evaluationPeriod: Option;
  classGroup: {
    discipline: Discipline;
    code: string;
    academicTerm: { code: string };
  };
};

type Catalog = {
  disciplines: Discipline[];
  assignees: Assignee[];
  periods: Option[];
  evaluations: Evaluation[];
};

type Filters = {
  disciplineId: string;
  status: string;
  assigneeId: string;
  periodId: string;
};

type View =
  | { kind: "list" }
  | { kind: "detail"; id: string }
  | { kind: "form"; plan?: Plan };

const textLimit = 2000;
const emptyFilters: Filters = {
  disciplineId: "",
  status: "",
  assigneeId: "",
  periodId: "",
};
const statuses: Record<Status, { label: string; style: string }> = {
  PENDING: { label: "Pendente", style: "pending" },
  IN_PROGRESS: { label: "Em andamento", style: "inactive" },
  COMPLETED: { label: "Concluída", style: "active" },
};
const statusOptions = Object.entries(statuses).map(([id, { label }]) => ({
  id,
  name: label,
}));
const roleLabels: Record<Role, string> = {
  ADMIN: "Administração",
  COORDINATOR: "Coordenação",
  PROFESSOR: "Docente",
};

const historyDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDueDate(date: string) {
  return date.split("-").reverse().join("/");
}

function uniqueOptions(options: Option[]) {
  return Array.from(
    new Map(options.map((option) => [option.id, option])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function SelectField({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  placeholder?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="improvement-plans__field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const { label, style } = statuses[status];
  return <span className={`ui-status ui-status--${style}`}>{label}</span>;
}

function Feedback({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error && (
        <p className="ui-feedback ui-feedback--error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="ui-feedback ui-feedback--success" role="status">
          {success}
        </p>
      )}
    </>
  );
}

function PlanOverview({ plan, headingId }: { plan: Plan; headingId?: string }) {
  return (
    <>
      <div className="ui-card__header">
        <h3 className="ui-card__title" id={headingId}>
          {plan.discipline.code} · {plan.discipline.name}
        </h3>
        <StatusBadge status={plan.status} />
      </div>
      <p className="ui-card__meta">
        Responsável: {plan.assignee.name} · Prazo: {formatDueDate(plan.dueDate)}
      </p>
      {plan.originPeriod && (
        <p className="ui-card__meta">
          Origem: {plan.originPeriod.name}
          {plan.originEvaluation &&
            ` · Turma ${plan.originEvaluation.classCode}`}
        </p>
      )}
    </>
  );
}

function PlanDetails({
  id,
  canManage,
  onEdit,
  onBack,
  onChanged,
}: {
  id: string;
  canManage: boolean;
  onEdit: (plan: Plan) => void;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void request<PlanDetail>(`${apiPath}/${id}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setPlan(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [id]);

  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan || !selectedStatus || selectedStatus === plan.status || saving)
      return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await request<PlanDetail>(`${apiPath}/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: selectedStatus }),
      });
      setPlan(updated);
      setSelectedStatus(null);
      setSuccess("Situação atualizada.");
      onChanged();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="ui-card__actions">
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={onBack}
          disabled={saving}
        >
          Voltar para planos
        </button>
        {canManage && plan && (
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            disabled={saving}
            data-focus-id={`edit-plan-${id}`}
            onClick={() => onEdit(plan)}
          >
            Editar plano
          </button>
        )}
      </div>
      <Feedback error={error} success={success} />
      {!plan && !error && (
        <p role="status" className="ui-feedback">
          Carregando plano...
        </p>
      )}
      {plan && (
        <>
          <article className="evaluation-card ui-card improvement-plans__section">
            <PlanOverview plan={plan} headingId="plan-detail-heading" />
            <dl className="improvement-plans__description">
              <dt>Problema identificado</dt>
              <dd>{plan.problem}</dd>
              <dt>Ação planejada</dt>
              <dd>{plan.action}</dd>
            </dl>
          </article>
          <form
            className="evaluation-card ui-form"
            aria-label="Atualizar situação"
            onSubmit={changeStatus}
          >
            <h3>Acompanhar execução</h3>
            <SelectField
              id="plan-next-status"
              label="Situação"
              options={statusOptions}
              value={selectedStatus ?? plan.status}
              onChange={(value) => setSelectedStatus(value as Status)}
            />
            <div className="ui-form__actions">
              <button
                className="ui-btn ui-btn--primary"
                type="submit"
                disabled={
                  saving || !selectedStatus || selectedStatus === plan.status
                }
              >
                {saving ? "Salvando..." : "Atualizar situação"}
              </button>
            </div>
          </form>
          <section
            className="improvement-plans__section"
            aria-labelledby="plan-history-heading"
          >
            <h3 id="plan-history-heading">Histórico de situações</h3>
            <ol className="evaluation-list">
              {plan.history.map((event) => (
                <li key={event.id} className="evaluation-card ui-card">
                  <div className="ui-card__header">
                    <h4 className="ui-card__title">
                      {event.previousStatus
                        ? `De ${statuses[event.previousStatus].label} para ${statuses[event.status].label}`
                        : "Plano cadastrado"}
                    </h4>
                    <StatusBadge status={event.status} />
                  </div>
                  <p className="ui-card__meta">
                    {event.author.name} ·{" "}
                    <time dateTime={event.changedAt}>
                      {historyDate.format(new Date(event.changedAt))}
                    </time>
                  </p>
                </li>
              ))}
            </ol>
          </section>
          {canManage && (
            <ImprovementPlanComparison
              planId={plan.id}
              hasOrigin={Boolean(plan.originPeriod)}
            />
          )}
        </>
      )}
    </>
  );
}

function PlanEditor({
  plan,
  onCancel,
  onSaved,
}: {
  plan?: Plan;
  onCancel: () => void;
  onSaved: (plan: PlanDetail) => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [disciplineId, setDisciplineId] = useState(plan?.discipline.id ?? "");
  const [assigneeId, setAssigneeId] = useState(plan?.assignee.id ?? "");
  const [originType, setOriginType] = useState(
    plan?.originEvaluation ? "evaluation" : plan?.originPeriod ? "period" : "",
  );
  const [periodId, setPeriodId] = useState(plan?.originPeriod?.id ?? "");
  const [evaluationId, setEvaluationId] = useState(
    plan?.originEvaluation?.id ?? "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    void Promise.all([
      request<Discipline[]>("/academic/disciplines", options),
      request<Assignee[]>(`${apiPath}/assignees`, options),
      request<Option[]>("/evaluations/periods", options),
      request<Evaluation[]>("/evaluations", options),
    ])
      .then(([disciplines, assignees, periods, evaluations]) => {
        if (!controller.signal.aborted)
          setCatalog({ disciplines, assignees, periods, evaluations });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      });
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const input = new FormData(event.currentTarget);
    const payload = {
      ...(plan ? {} : { disciplineId }),
      problem: String(input.get("problem") ?? "").trim(),
      action: String(input.get("action") ?? "").trim(),
      assigneeId,
      dueDate: input.get("dueDate"),
      originPeriodId: originType === "period" ? periodId : null,
      originEvaluationId: originType === "evaluation" ? evaluationId : null,
    };
    if (!payload.problem || !payload.action) {
      setError("Preencha o problema identificado e a ação planejada.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await request<PlanDetail>(
        plan ? `${apiPath}/${plan.id}` : apiPath,
        {
          method: plan ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      onSaved(result);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (!catalog) {
    return (
      <>
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={onCancel}
        >
          Voltar
        </button>
        <Feedback error={error} />
        {!error && (
          <p role="status" className="ui-feedback">
            Carregando formulário...
          </p>
        )}
      </>
    );
  }

  const assignees = catalog.assignees.map((user) => ({
    id: user.id,
    name: `${user.name} · ${roleLabels[user.role]}`,
  }));
  if (plan && !assignees.some(({ id }) => id === plan.assignee.id)) {
    assignees.unshift({
      id: plan.assignee.id,
      name: `${plan.assignee.name} (responsável atual)`,
    });
  }
  const evaluations = catalog.evaluations
    .filter(({ classGroup }) => classGroup.discipline.id === disciplineId)
    .map(({ id, evaluationPeriod, classGroup }) => ({
      id,
      name: `${evaluationPeriod.name} · Turma ${classGroup.code} · ${classGroup.academicTerm.code}`,
    }));

  return (
    <form className="evaluation-card ui-form" onSubmit={save}>
      <h3 id="plan-editor-heading">
        {plan ? "Editar plano de melhoria" : "Cadastrar plano de melhoria"}
      </h3>
      <Feedback error={error} />
      <fieldset className="improvement-plans__fields" disabled={saving}>
        {plan ? (
          <p className="ui-card__meta">
            Disciplina: {plan.discipline.code} · {plan.discipline.name}
          </p>
        ) : (
          <SelectField
            id="plan-discipline"
            label="Disciplina"
            placeholder="Selecione uma disciplina"
            required
            options={catalog.disciplines.map(({ id, name, code }) => ({
              id,
              name: `${code} · ${name}`,
            }))}
            value={disciplineId}
            onChange={(id) => {
              setDisciplineId(id);
              setEvaluationId("");
            }}
          />
        )}
        <p className="ui-card__meta">
          Descreva o problema e a ação sem incluir nomes ou respostas
          individuais de estudantes.
        </p>
        <div className="improvement-plans__field">
          <label htmlFor="plan-problem">Problema identificado</label>
          <textarea
            id="plan-problem"
            name="problem"
            required
            rows={3}
            maxLength={textLimit}
            defaultValue={plan?.problem}
          />
        </div>
        <div className="improvement-plans__field">
          <label htmlFor="plan-action">Ação planejada</label>
          <textarea
            id="plan-action"
            name="action"
            required
            rows={3}
            maxLength={textLimit}
            defaultValue={plan?.action}
          />
        </div>
        <div className="improvement-plans__grid">
          <SelectField
            id="plan-assignee"
            label="Responsável"
            placeholder="Selecione um responsável"
            required
            options={assignees}
            value={assigneeId}
            onChange={setAssigneeId}
          />
          <div className="improvement-plans__field">
            <label htmlFor="plan-due-date">Prazo previsto</label>
            <input
              type="date"
              id="plan-due-date"
              name="dueDate"
              required
              max="9999-12-31"
              defaultValue={plan?.dueDate}
            />
          </div>
          <SelectField
            id="plan-origin-type"
            label="Origem (opcional)"
            placeholder="Sem vínculo"
            options={[
              { id: "period", name: "Período de avaliação" },
              { id: "evaluation", name: "Avaliação" },
            ]}
            value={originType}
            onChange={setOriginType}
          />
          {originType === "period" && (
            <SelectField
              id="plan-origin-period"
              label="Período de origem"
              placeholder="Selecione um período"
              required
              options={catalog.periods}
              value={periodId}
              onChange={setPeriodId}
            />
          )}
          {originType === "evaluation" && (
            <SelectField
              id="plan-origin-evaluation"
              label="Avaliação de origem"
              required
              placeholder={
                evaluations.length
                  ? "Selecione uma avaliação"
                  : "Nenhuma avaliação para a disciplina"
              }
              options={evaluations}
              value={evaluationId}
              onChange={setEvaluationId}
            />
          )}
        </div>
      </fieldset>
      <div className="ui-form__actions">
        <button
          type="submit"
          className="ui-btn ui-btn--primary"
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar plano"}
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function ImprovementPlans({ role }: { role: Role }) {
  const canManage = role !== "PROFESSOR";
  const [view, setView] = useState<View>({ kind: "list" });
  const [filters, setFilters] = useState(emptyFilters);
  const [loadVersion, setLoadVersion] = useState(0);
  const [list, setList] = useState<{
    version: number;
    plans?: Plan[];
    error?: string;
  } | null>(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void request<Plan[]>(apiPath, { signal: controller.signal })
      .then((plans) => {
        if (!controller.signal.aborted)
          setList({ version: loadVersion, plans });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setList({ version: loadVersion, error: errorMessage(reason) });
      });
    return () => controller.abort();
  }, [loadVersion]);

  function goToList() {
    setView({ kind: "list" });
    setSuccess("");
  }

  function changeFilter(field: keyof Filters, value: string) {
    setFilters((previous) => ({ ...previous, [field]: value }));
  }

  const plans = list?.version === loadVersion ? list.plans : undefined;
  const listError = list?.version === loadVersion ? list.error : undefined;
  const rememberFocus = useViewFocus(
    view.kind === "detail" ? `detail-${view.id}` : view.kind,
    view.kind === "form"
      ? "#plan-editor-heading"
      : view.kind === "detail"
        ? "#plan-detail-heading"
        : "#improvement-plans-heading",
    view.kind !== "list" || Boolean(plans || listError),
  );
  const disciplines = uniqueOptions(
    (plans ?? []).map(({ discipline }) => ({
      id: discipline.id,
      name: `${discipline.code} · ${discipline.name}`,
    })),
  );
  const assignees = uniqueOptions(
    (plans ?? []).map(({ assignee }) => assignee),
  );
  const periods = uniqueOptions(
    (plans ?? []).flatMap(({ originPeriod }) =>
      originPeriod ? [originPeriod] : [],
    ),
  );
  const visiblePlans = plans?.filter(
    (plan) =>
      (!filters.disciplineId || plan.discipline.id === filters.disciplineId) &&
      (!filters.status || plan.status === filters.status) &&
      (!filters.assigneeId || plan.assignee.id === filters.assigneeId) &&
      (!filters.periodId || plan.originPeriod?.id === filters.periodId),
  );

  return (
    <section
      className="improvement-plans"
      aria-labelledby="improvement-plans-heading"
    >
      <h2 id="improvement-plans-heading">
        {canManage ? "Planos de melhoria" : "Meus planos de melhoria"}
      </h2>
      <Feedback success={success} />

      {view.kind === "form" && canManage && (
        <PlanEditor
          key={view.plan?.id ?? "new"}
          plan={view.plan}
          onCancel={() =>
            view.plan
              ? setView({ kind: "detail", id: view.plan.id })
              : goToList()
          }
          onSaved={(plan) => {
            setLoadVersion((version) => version + 1);
            setSuccess(view.plan ? "Plano atualizado." : "Plano cadastrado.");
            setView({ kind: "detail", id: plan.id });
          }}
        />
      )}

      {view.kind === "detail" && (
        <PlanDetails
          key={view.id}
          id={view.id}
          canManage={canManage}
          onBack={goToList}
          onEdit={(plan) => {
            rememberFocus(`edit-plan-${plan.id}`);
            setSuccess("");
            setView({ kind: "form", plan });
          }}
          onChanged={() => {
            setSuccess("");
            setLoadVersion((version) => version + 1);
          }}
        />
      )}

      {view.kind === "list" && (
        <>
          {canManage && (
            <div className="ui-card__actions">
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                data-focus-id="new-plan"
                onClick={() => {
                  rememberFocus("new-plan");
                  setView({ kind: "form" });
                }}
              >
                Novo plano
              </button>
            </div>
          )}
          {listError && (
            <>
              <Feedback error={listError} />
              <button
                type="button"
                className="ui-btn ui-btn--secondary"
                onClick={() => setLoadVersion((version) => version + 1)}
              >
                Tentar novamente
              </button>
            </>
          )}
          {!plans && !listError && (
            <p className="ui-feedback" role="status">
              Carregando planos...
            </p>
          )}
          {plans && plans.length > 0 && (
            <form
              className="evaluation-card ui-form"
              aria-label="Filtros dos planos"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="improvement-plans__grid">
                <SelectField
                  id="plan-filter-discipline"
                  label="Disciplina"
                  placeholder="Todas as disciplinas"
                  options={disciplines}
                  value={filters.disciplineId}
                  onChange={(id) => changeFilter("disciplineId", id)}
                />
                <SelectField
                  id="plan-filter-status"
                  label="Situação"
                  placeholder="Todas as situações"
                  options={statusOptions}
                  value={filters.status}
                  onChange={(value) => changeFilter("status", value)}
                />
                {canManage && (
                  <SelectField
                    id="plan-filter-assignee"
                    label="Responsável"
                    placeholder="Todos os responsáveis"
                    options={assignees}
                    value={filters.assigneeId}
                    onChange={(id) => changeFilter("assigneeId", id)}
                  />
                )}
                <SelectField
                  id="plan-filter-period"
                  label="Período de origem"
                  placeholder="Todos os períodos"
                  options={periods}
                  value={filters.periodId}
                  onChange={(id) => changeFilter("periodId", id)}
                />
              </div>
              <div className="ui-form__actions">
                <button
                  type="button"
                  className="ui-btn ui-btn--secondary"
                  onClick={() => setFilters(emptyFilters)}
                >
                  Limpar filtros
                </button>
              </div>
            </form>
          )}
          {visiblePlans?.length === 0 && (
            <p className="ui-feedback" role="status">
              {plans?.length
                ? "Nenhum plano corresponde aos filtros."
                : "Nenhum plano de melhoria disponível."}
            </p>
          )}
          {visiblePlans && visiblePlans.length > 0 && (
            <ul className="evaluation-list improvement-plans__section">
              {visiblePlans.map((plan) => (
                <li key={plan.id} className="evaluation-card ui-card">
                  <PlanOverview plan={plan} />
                  <p className="improvement-plans__summary">{plan.action}</p>
                  <div className="ui-card__actions">
                    <button
                      type="button"
                      className="ui-btn ui-btn--secondary"
                      data-focus-id={`plan-${plan.id}`}
                      onClick={() => {
                        rememberFocus(`plan-${plan.id}`);
                        setView({ kind: "detail", id: plan.id });
                      }}
                    >
                      Ver plano
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
