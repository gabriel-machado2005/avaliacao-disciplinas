import { useEffect, useState, type FormEvent } from "react";
import EvaluationQuestionMetrics, {
  type QuestionResult,
} from "./EvaluationQuestionMetrics";
import { apiPath, errorMessage, request } from "./improvement-plans-api";

type Period = { id: string; name: string };

type Comparison = {
  originPeriod: Period | null;
  followUpPeriod: Period | null;
  savedPeriodId: string | null;
  periods: Period[];
  status:
    | "NO_ORIGIN"
    | "SELECT_PERIOD"
    | "INVALID_PERIOD"
    | "OPEN"
    | "NO_RESULTS"
    | "NO_COMPATIBLE_QUESTIONS"
    | "AVAILABLE";
  message: string | null;
  questions: QuestionResult[];
};

export default function ImprovementPlanComparison({
  planId,
  hasOrigin,
}: {
  planId: string;
  hasOrigin: boolean;
}) {
  const path = `${apiPath}/${planId}/comparison`;
  const [report, setReport] = useState<Comparison | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!hasOrigin) return;
    const controller = new AbortController();
    void request<Comparison>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setReport(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [path, hasOrigin]);

  const selectedId = selection ?? report?.savedPeriodId ?? "";
  const savedPeriod = report?.periods.find(
    ({ id }) => id === report.savedPeriodId,
  );
  const current = Boolean(
    report && selectedId === (report.followUpPeriod?.id ?? ""),
  );
  const showComparison = !error && current && report?.status === "AVAILABLE";
  const allowSave = showComparison && report.savedPeriodId !== selectedId;
  const message =
    current || report?.status === "INVALID_PERIOD" ? report?.message : null;
  const comparedPeriods =
    report?.followUpPeriod && report.originPeriod
      ? [report.followUpPeriod, report.originPeriod]
      : [];

  async function run(change?: { periodId: string | null }) {
    setWorking(true);
    setError("");
    setSuccess("");
    try {
      const data = change
        ? await request<Comparison>(path, {
            method: "PATCH",
            body: JSON.stringify(change),
          })
        : await request<Comparison>(
            `${path}?${new URLSearchParams({ periodId: selectedId })}`,
          );
      setReport(data);
      if (change) {
        setSelection(null);
        setSuccess(
          change.periodId
            ? "Período de acompanhamento vinculado."
            : "Vínculo de acompanhamento removido.",
        );
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setWorking(false);
    }
  }

  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedId && !working) void run();
  }

  return (
    <section
      className="improvement-plans__section"
      aria-labelledby="plan-comparison-heading"
    >
      <h3 id="plan-comparison-heading">
        Comparação com resultados posteriores
      </h3>
      {!hasOrigin && (
        <p className="ui-feedback">
          Defina uma origem no plano para comparar os resultados. Vincule um
          período ou uma avaliação da disciplina em Editar plano.
        </p>
      )}
      {hasOrigin && !report && !error && (
        <p role="status" className="ui-feedback">
          Carregando períodos e resultados...
        </p>
      )}
      {error && (
        <p role="alert" className="ui-feedback ui-feedback--error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="ui-feedback ui-feedback--success">
          {success}
        </p>
      )}
      {report?.savedPeriodId && (
        <p className="ui-feedback">
          <span className="ui-status ui-status--active">Período vinculado</span>{" "}
          {savedPeriod?.name ?? "Período indisponível"}
        </p>
      )}
      {report && (report.periods.length > 0 || report.savedPeriodId) && (
        <form
          className="evaluation-card ui-form"
          onSubmit={preview}
          aria-label="Comparar resultados do plano"
        >
          <div className="improvement-plans__field">
            <label htmlFor="plan-follow-up-period">Período posterior</label>
            <select
              id="plan-follow-up-period"
              disabled={working || !report.periods.length}
              value={selectedId}
              onChange={(event) => {
                setSelection(event.target.value);
                setError("");
                setSuccess("");
              }}
            >
              <option value="">Selecione um período</option>
              {report.periods.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="ui-form__actions">
            <button
              type="submit"
              className="ui-btn ui-btn--primary"
              disabled={working || !selectedId}
            >
              Comparar resultados
            </button>
            {allowSave && (
              <button
                type="button"
                className="ui-btn ui-btn--secondary"
                disabled={working}
                onClick={() => void run({ periodId: selectedId })}
              >
                Vincular período
              </button>
            )}
            {report.savedPeriodId && (
              <button
                type="button"
                className="ui-btn ui-btn--secondary"
                disabled={working}
                onClick={() => void run({ periodId: null })}
              >
                Remover vínculo
              </button>
            )}
          </div>
        </form>
      )}
      {working && (
        <p role="status" className="ui-feedback">
          Processando comparação...
        </p>
      )}
      {message && !working && (
        <p className="ui-feedback" role="status">
          {message}
        </p>
      )}
      {showComparison && !working && (
        <>
          <h4>Perguntas comparáveis</h4>
          <p className="ui-feedback">
            As variações comparam os resultados divulgáveis dos dois períodos. A
            comparação é descritiva e pode refletir diferenças entre as turmas.
          </p>
          <ul className="evaluation-list">
            {report.questions.map((question) => (
              <li
                key={`${question.questionId}:${question.scaleMin}:${question.scaleMax}`}
              >
                <EvaluationQuestionMetrics
                  question={question}
                  periods={comparedPeriods}
                  showDimension
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
