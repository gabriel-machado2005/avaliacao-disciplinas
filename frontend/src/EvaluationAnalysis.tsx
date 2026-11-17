import { useEffect, useState } from "react";
import EvaluationQuestionMetrics, {
  MetricBar,
  type QuestionResult,
} from "./EvaluationQuestionMetrics";
import EvaluationResults from "./EvaluationResults";

type Option = { id: string; name: string };
type PeriodOption = Option & { endDate: string };
type DisciplineOption = Option & { course: Option };
type DimensionOption = Option & { questionnaireName: string };
type Catalog = {
  periods: PeriodOption[];
  courses: Option[];
  disciplines: DisciplineOption[];
};

type Filters = {
  periodId: string;
  comparisonPeriodId: string;
  courseId: string;
  disciplineId: string;
  professorId: string;
  dimensionId: string;
};

type PeriodResult = Option & {
  status: "AVAILABLE" | "NO_RESULTS" | "OPEN";
  participation: {
    eligible: number;
    responses: number;
    rate: number | null;
  } | null;
  evaluations: {
    id: string;
    classGroup: string;
    discipline: string;
    course: string;
    academicTerm: string;
    professor: string;
  }[];
};

type Analysis = {
  periods: PeriodResult[];
  filterOptions: { professors: Option[]; dimensions: DimensionOption[] };
  questions: QuestionResult[];
};

const emptyFilters: Filters = {
  periodId: "",
  comparisonPeriodId: "",
  courseId: "",
  disciplineId: "",
  professorId: "",
  dimensionId: "",
};

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});
const differenceFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

async function fetchData<Data>(
  path: string,
  signal: AbortSignal,
): Promise<Data> {
  const token = sessionStorage.getItem("accessToken");
  if (!token) {
    throw new Error("Faça login novamente para continuar.");
  }

  const response = await fetch(`http://localhost:3000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (!response.ok) {
    const data: { message?: string | string[] } = await response
      .json()
      .catch(() => ({}));
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : "Não foi possível consultar a análise de resultados.",
    );
  }
  return response.json();
}

function SelectFilter({
  id,
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="evaluation-analysis__field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ParticipationCard({ period }: { period: PeriodResult }) {
  const { participation } = period;

  return (
    <article className="evaluation-card ui-card">
      <div className="ui-card__header">
        <h4 className="ui-card__title">{period.name}</h4>
        <span
          className={`ui-status ui-status--${participation ? "active" : "pending"}`}
        >
          {participation
            ? "Resultados liberados"
            : period.status === "OPEN"
              ? "Aguardando encerramento"
              : "Sem resultados liberados"}
        </span>
      </div>
      {participation ? (
        <>
          <p className="ui-card__meta">
            {numberFormat.format(participation.responses)} respostas de{" "}
            {numberFormat.format(participation.eligible)} habilitações ·{" "}
            {period.evaluations.length}{" "}
            {period.evaluations.length === 1 ? "avaliação" : "avaliações"}
          </p>
          {participation.rate === null ? (
            <p>Taxa de participação indisponível.</p>
          ) : (
            <>
              <p>
                Taxa de participação{" "}
                <b>{numberFormat.format(participation.rate)}%</b>
              </p>
              <MetricBar width={participation.rate} />
            </>
          )}
        </>
      ) : (
        <p className="ui-card__meta">
          {period.status === "OPEN"
            ? "Os resultados podem ser liberados após o encerramento do período."
            : "Nenhuma avaliação liberada para os filtros selecionados."}
        </p>
      )}
    </article>
  );
}

function AnalysisResults({
  data,
  onOpenEvaluation,
}: {
  data: Analysis;
  onOpenEvaluation: (id: string) => void;
}) {
  const [current, comparison] = data.periods;
  const currentRate = current.participation?.rate;
  const comparisonRate = comparison?.participation?.rate;
  const dimensions = new Map<string, QuestionResult[]>();
  for (const question of data.questions) {
    const questions = dimensions.get(question.dimensionId) ?? [];
    questions.push(question);
    dimensions.set(question.dimensionId, questions);
  }

  return (
    <>
      <section aria-labelledby="analysis-participation">
        <h3 id="analysis-participation">Participação</h3>
        <div className="evaluation-analysis__grid">
          {data.periods.map((period) => (
            <ParticipationCard key={period.id} period={period} />
          ))}
        </div>
        {comparison && (
          <p className="ui-feedback">
            {currentRate != null && comparisonRate != null
              ? `Variação de ${comparison.name} para ${current.name} de ${differenceFormat.format(currentRate - comparisonRate)} pontos percentuais.`
              : "A variação de participação exige uma taxa disponível em cada período."}
          </p>
        )}
      </section>

      <section aria-labelledby="analysis-questions">
        <h3 id="analysis-questions">
          {comparison ? "Comparação por dimensão" : "Notas por dimensão"}
        </h3>
        <p className="ui-feedback">
          {comparison
            ? "A comparação inclui perguntas de escala reutilizadas que atingiram o mínimo de respostas nos dois períodos."
            : "As médias usam as respostas válidas das perguntas de escala que atingiram o mínimo por avaliação."}
        </p>
        {dimensions.size === 0 && (
          <p className="ui-feedback">
            {comparison
              ? "Não há perguntas compatíveis com resultados liberados nos dois períodos neste recorte."
              : "Não há notas de perguntas de escala disponíveis para os filtros selecionados."}
          </p>
        )}
        {Array.from(dimensions, ([id, questions]) => (
          <section
            key={id}
            className="results-dimension"
            aria-labelledby={`analysis-dimension-${id}`}
          >
            <h4 id={`analysis-dimension-${id}`} className="ui-card__title">
              {questions[0].dimensionName}
            </h4>
            <p className="ui-feedback">{questions[0].questionnaireName}</p>
            <div className="evaluation-analysis__stack">
              {questions.map((question) => (
                <EvaluationQuestionMetrics
                  key={`${question.questionId}:${question.scaleMin}:${question.scaleMax}`}
                  question={question}
                  periods={data.periods}
                />
              ))}
            </div>
          </section>
        ))}
      </section>

      {data.periods.some((period) => period.evaluations.length > 0) && (
        <section aria-labelledby="analysis-evaluations">
          <h3 id="analysis-evaluations">Avaliações incluídas</h3>
          {data.periods
            .filter((period) => period.evaluations.length > 0)
            .map((period) => (
              <div key={period.id}>
                <h4>{period.name}</h4>
                <ul className="evaluation-list">
                  {period.evaluations.map((evaluation) => (
                    <li key={evaluation.id} className="evaluation-card ui-card">
                      <h5 className="ui-card__title">
                        {evaluation.discipline} · Turma {evaluation.classGroup}
                      </h5>
                      <p className="ui-card__meta">
                        {evaluation.course} · {evaluation.academicTerm} ·{" "}
                        {evaluation.professor}
                      </p>
                      <div className="ui-card__actions">
                        <button
                          type="button"
                          className="ui-btn ui-btn--secondary"
                          onClick={() => onOpenEvaluation(evaluation.id)}
                        >
                          Ver resultados
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </section>
      )}
    </>
  );
}

export default function EvaluationAnalysis() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [report, setReport] = useState<{
    filters: Filters;
    data: Analysis;
  } | null>(null);
  const [reportError, setReportError] = useState<{
    filters: Filters;
    message: string;
  } | null>(null);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void Promise.all([
      fetchData<PeriodOption[]>("/evaluations/periods", signal),
      fetchData<Option[]>("/academic/courses", signal),
      fetchData<DisciplineOption[]>("/academic/disciplines", signal),
    ])
      .then(([periods, courses, disciplines]) => {
        if (!signal.aborted) {
          setCatalog({ periods, courses, disciplines });
          const initial =
            periods.find(
              (period) => Date.now() > new Date(period.endDate).getTime(),
            ) ?? periods[0];
          setFilters({ ...emptyFilters, periodId: initial?.id ?? "" });
        }
      })
      .catch((error: Error) => {
        if (!signal.aborted) {
          setCatalogError(error.message);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!filters.periodId) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value),
    );
    void fetchData<Analysis>(`/evaluations/analysis?${params}`, signal)
      .then((data) => {
        if (!signal.aborted) {
          setReport({ filters, data });
        }
      })
      .catch((error: Error) => {
        if (!signal.aborted) {
          setReportError({ filters, message: error.message });
        }
      });

    return () => controller.abort();
  }, [filters]);

  function changeFilter(field: keyof Filters, value: string) {
    setFilters((previous) => {
      const updated = { ...previous, [field]: value };
      if (field === "periodId" && updated.comparisonPeriodId === value) {
        updated.comparisonPeriodId = "";
      }
      if (
        field === "courseId" &&
        !catalog?.disciplines.some(
          ({ id, course }) =>
            id === updated.disciplineId && (!value || course.id === value),
        )
      ) {
        updated.disciplineId = "";
      }
      return updated;
    });
  }

  if (evaluationId) {
    return (
      <EvaluationResults
        evaluationId={evaluationId}
        backLabel="Voltar para análise"
        onBack={() => setEvaluationId(null)}
      />
    );
  }

  const sameScope =
    report &&
    report.filters.periodId === filters.periodId &&
    report.filters.comparisonPeriodId === filters.comparisonPeriodId &&
    report.filters.courseId === filters.courseId &&
    report.filters.disciplineId === filters.disciplineId;
  const professorOptions = (report?.data.filterOptions.professors ?? []).filter(
    ({ id }) => sameScope || id === filters.professorId,
  );
  const dimensionOptions = (report?.data.filterOptions.dimensions ?? [])
    .filter(
      ({ id }) =>
        (sameScope && report?.filters.professorId === filters.professorId) ||
        id === filters.dimensionId,
    )
    .map(({ id, name, questionnaireName }) => ({
      id,
      name: `${name} (${questionnaireName})`,
    }));
  const results = report?.filters === filters ? report.data : null;
  const error = reportError?.filters === filters ? reportError.message : "";
  const loading = Boolean(filters.periodId) && !results && !error;

  return (
    <section className="evaluation-analysis" aria-labelledby="analysis-heading">
      <h2 id="analysis-heading">Painel de Análise de Resultados</h2>
      {catalogError && (
        <p role="alert" className="ui-feedback ui-feedback--error">
          {catalogError}
        </p>
      )}
      {!catalog && !catalogError && (
        <p role="status" className="ui-feedback">
          Carregando filtros...
        </p>
      )}
      {catalog?.periods.length === 0 && (
        <p role="status" className="ui-feedback">
          Nenhum período de avaliação cadastrado.
        </p>
      )}

      {catalog && catalog.periods.length > 0 && (
        <form
          className="evaluation-card ui-form"
          aria-label="Filtros da análise"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="evaluation-analysis__grid">
            <SelectFilter
              id="analysis-period"
              label="Período de avaliação"
              placeholder="Selecione um período"
              value={filters.periodId}
              options={catalog.periods}
              onChange={(id) => changeFilter("periodId", id)}
            />
            <SelectFilter
              id="analysis-comparison"
              label="Comparar com"
              placeholder="Selecione outro período"
              value={filters.comparisonPeriodId}
              options={catalog.periods.filter(
                ({ id }) => id !== filters.periodId,
              )}
              onChange={(id) => changeFilter("comparisonPeriodId", id)}
              disabled={!filters.periodId}
            />
            <SelectFilter
              id="analysis-course"
              label="Curso"
              placeholder="Todos os cursos"
              value={filters.courseId}
              options={catalog.courses}
              onChange={(id) => changeFilter("courseId", id)}
            />
            <SelectFilter
              id="analysis-discipline"
              label="Disciplina"
              placeholder="Todas as disciplinas"
              value={filters.disciplineId}
              options={catalog.disciplines.filter(
                ({ course }) =>
                  !filters.courseId || course.id === filters.courseId,
              )}
              onChange={(id) => changeFilter("disciplineId", id)}
            />
            <SelectFilter
              id="analysis-professor"
              label="Professor"
              placeholder="Todos os professores"
              value={filters.professorId}
              options={professorOptions}
              onChange={(id) => changeFilter("professorId", id)}
              disabled={professorOptions.length === 0}
            />
            <SelectFilter
              id="analysis-dimension"
              label="Dimensão"
              placeholder="Todas as dimensões"
              value={filters.dimensionId}
              options={dimensionOptions}
              onChange={(id) => changeFilter("dimensionId", id)}
              disabled={dimensionOptions.length === 0}
            />
          </div>
          <div className="ui-form__actions">
            <button
              type="button"
              className="ui-btn ui-btn--secondary"
              onClick={() =>
                setFilters({ ...emptyFilters, periodId: filters.periodId })
              }
            >
              Limpar filtros
            </button>
          </div>
        </form>
      )}

      {loading && (
        <p role="status" className="ui-feedback">
          Carregando análise...
        </p>
      )}
      {error && (
        <div className="ui-card__actions">
          <p role="alert" className="ui-feedback ui-feedback--error">
            {error}
          </p>
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            onClick={() => setFilters({ ...filters })}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {results && (
        <AnalysisResults data={results} onOpenEvaluation={setEvaluationId} />
      )}
    </section>
  );
}
