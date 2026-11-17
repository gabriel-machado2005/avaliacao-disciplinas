import { useEffect, useState } from "react";
import {
  buildEvaluationResultsCsv,
  questionStatusLabels,
  type EvaluationResult,
} from "./evaluation-results-csv";

type Props = {
  evaluationId: string;
  onBack: () => void;
  backLabel?: string;
};

function exportEvaluationResultsCsv(results: EvaluationResult) {
  const blob = new Blob([buildEvaluationResultsCsv(results)], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const filename = [
    results.evaluation.discipline.code,
    results.evaluation.academicTerm,
  ]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  link.href = url;
  link.download = `relatorio_${filename}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EvaluationResults({
  evaluationId,
  onBack,
  backLabel = "Voltar para avaliações",
}: Props) {
  const [results, setResults] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadResults() {
      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const response = await fetch(
          `http://localhost:3000/evaluations/${evaluationId}/results`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const data: { message?: string } = await response
            .json()
            .catch(() => ({}));

          throw new Error(
            data.message ?? "Não foi possível consultar os resultados.",
          );
        }

        const data: EvaluationResult = await response.json();

        if (!controller.signal.aborted) {
          setResults(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar resultados.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadResults();

    return () => controller.abort();
  }, [evaluationId]);

  return (
    <section>
      <button
        type="button"
        className="ui-btn ui-btn--secondary"
        onClick={onBack}
      >
        {backLabel}
      </button>

      <h2>Resultados da avaliação</h2>

      {results && (
        <div className="ui-card__actions">
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() => exportEvaluationResultsCsv(results)}
          >
            Exportar relatório (CSV)
          </button>
        </div>
      )}

      {loading && <p>Carregando resultados...</p>}

      {error && <p role="alert">{error}</p>}

      {results && (
        <>
          <h3>{results.evaluation.discipline.name}</h3>

          <p>Turma: {results.evaluation.classGroup}</p>
          <p>Semestre: {results.evaluation.academicTerm}</p>

          <div className="evaluation-card ui-card">
            <h3 className="ui-card__title">Participação</h3>

            <p className="ui-card__meta">
              Estudantes habilitados: {results.participation.eligible}
            </p>

            <p className="ui-card__meta">
              Respostas recebidas: {results.participation.responses}
            </p>

            <p className="ui-card__meta">
              Taxa de participação: {results.participation.rate}%
            </p>
          </div>

          {results.dimensions.map((dimension) => (
            <section key={dimension.id} className="results-dimension">
              <h3 className="ui-card__title results-dimension__title">
                {dimension.name}
              </h3>

              {dimension.questions.map((question) => (
                <div key={question.id} className="evaluation-card ui-card">
                  <div className="ui-card__header">
                    <h4 className="ui-card__title">{question.text}</h4>
                    {question.status !== "AVAILABLE" && (
                      <span
                        className={`ui-status ui-status--${question.status === "NO_RESPONSES" ? "inactive" : "pending"}`}
                      >
                        {questionStatusLabels[question.status]}
                      </span>
                    )}
                  </div>

                  {(question.status === "AVAILABLE" ||
                    question.status === "COMMENTS_PROTECTED") && (
                    <p className="ui-card__meta">
                      Respostas: {question.responses}
                    </p>
                  )}

                  {question.status === "PROTECTED" && (
                    <p className="ui-feedback">
                      Esta pergunta recebeu respostas abaixo do mínimo exigido
                      para divulgar as métricas.
                    </p>
                  )}

                  {question.status === "AVAILABLE" &&
                    question.type === "SCALE" && (
                      <>
                        <p>Média: {question.average.toLocaleString("pt-BR")}</p>

                        <h5>Distribuição</h5>

                        <div>
                          {Object.entries(question.distribution).map(
                            ([value, count]) => {
                              const percentage =
                                question.responses > 0
                                  ? (count / question.responses) * 100
                                  : 0;

                              return (
                                <div
                                  key={value}
                                  className="results-distribution__row"
                                >
                                  <span className="results-distribution__label results-distribution__label--scale">
                                    Nota {value}
                                  </span>

                                  <div className="results-distribution__track">
                                    <div
                                      className="results-distribution__fill"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>

                                  <span className="results-distribution__count">
                                    {count} ({percentage.toFixed(0)}%)
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </>
                    )}

                  {question.status === "AVAILABLE" &&
                    question.type === "SINGLE_CHOICE" && (
                      <>
                        <h5>Distribuição</h5>

                        <div>
                          {Object.entries(question.distribution).map(
                            ([option, count]) => {
                              const percentage =
                                question.responses > 0
                                  ? (count / question.responses) * 100
                                  : 0;

                              return (
                                <div
                                  key={option}
                                  className="results-distribution__row"
                                >
                                  <span className="results-distribution__label">
                                    {option}
                                  </span>

                                  <div className="results-distribution__track">
                                    <div
                                      className="results-distribution__fill"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>

                                  <span className="results-distribution__count">
                                    {count} ({percentage.toFixed(0)}%)
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </>
                    )}

                  {question.status === "COMMENTS_PROTECTED" && (
                    <p className="ui-feedback">
                      O texto dos comentários fica protegido para preservar o
                      anonimato dos estudantes.
                    </p>
                  )}
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
