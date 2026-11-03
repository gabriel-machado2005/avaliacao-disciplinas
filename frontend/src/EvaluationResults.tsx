import { useEffect, useState } from "react";

type ResultQuestion = {
  id: string;
  text: string;
  responses: number;
} & (
  | {
      type: "SCALE";
      average: number | null;
      distribution: Record<string, number>;
    }
  | {
      type: "SINGLE_CHOICE";
      distribution: Record<string, number>;
    }
  | {
      type: "TEXT";
      comments: string[];
    }
);

type EvaluationResult = {
  evaluation: {
    discipline: {
      name: string;
      code: string;
    };
    classGroup: string;
    academicTerm: string;
  };
  participation: {
    eligible: number;
    responses: number;
    rate: number;
  };
  dimensions: {
    id: string;
    name: string;
    questions: ResultQuestion[];
  }[];
};

type Props = {
  evaluationId: string;
  onBack: () => void;
};

export default function EvaluationResults({ evaluationId, onBack }: Props) {
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
      <button type="button" onClick={onBack}>
        Voltar para avaliações
      </button>

      <h2>Resultados da avaliação</h2>

      {loading && <p>Carregando resultados...</p>}

      {error && <p role="alert">{error}</p>}

      {results && (
        <>
          <h3>{results.evaluation.discipline.name}</h3>

          <p>Turma: {results.evaluation.classGroup}</p>
          <p>Semestre: {results.evaluation.academicTerm}</p>

          <div className="evaluation-card">
            <h3>Participação</h3>

            <p>Estudantes habilitados: {results.participation.eligible}</p>
            <p>Respostas recebidas: {results.participation.responses}</p>
            <p>Taxa de participação: {results.participation.rate}%</p>
          </div>

          {results.dimensions.map((dimension) => (
            <section key={dimension.id}>
              <h3>{dimension.name}</h3>

              {dimension.questions.map((question) => (
                <div key={question.id} className="evaluation-card">
                  <h4>{question.text}</h4>

                  <p>Respostas: {question.responses}</p>

                  {question.type === "SCALE" && (
                    <>
                      <p>
                        Média:{" "}
                        {question.average === null
                          ? "Sem respostas"
                          : question.average.toLocaleString("pt-BR")}
                      </p>

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
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  marginBottom: "12px",
                                }}
                              >
                                <span style={{ minWidth: "50px" }}>
                                  Nota {value}
                                </span>

                                <div
                                  style={{
                                    flex: 1,
                                    height: "12px",
                                    backgroundColor: "#e5e7eb",
                                    borderRadius: "10px",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${percentage}%`,
                                      height: "100%",
                                      backgroundColor: "#2563eb",
                                      borderRadius: "10px",
                                    }}
                                  />
                                </div>

                                <span
                                  style={{
                                    minWidth: "65px",
                                    textAlign: "right",
                                  }}
                                >
                                  {count} ({percentage.toFixed(0)}%)
                                </span>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </>
                  )}

                  {question.type === "SINGLE_CHOICE" && (
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
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  marginBottom: "12px",
                                }}
                              >
                                <span style={{ minWidth: "90px" }}>
                                  {option}
                                </span>

                                <div
                                  style={{
                                    flex: 1,
                                    height: "12px",
                                    backgroundColor: "#e5e7eb",
                                    borderRadius: "10px",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${percentage}%`,
                                      height: "100%",
                                      backgroundColor: "#2563eb",
                                      borderRadius: "10px",
                                    }}
                                  />
                                </div>

                                <span
                                  style={{
                                    minWidth: "65px",
                                    textAlign: "right",
                                  }}
                                >
                                  {count} ({percentage.toFixed(0)}%)
                                </span>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </>
                  )}

                  {question.type === "TEXT" && (
                    <>
                      <h5>Comentários</h5>

                      {question.comments.length === 0 ? (
                        <p>Nenhum comentário registrado.</p>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gap: "12px",
                          }}
                        >
                          {question.comments.map((comment, index) => (
                            <div
                              key={index}
                              style={{
                                padding: "14px 16px",
                                backgroundColor: "#ffffff",
                                border: "1px solid #e2e8f0",
                                borderLeft: "3px solid #2563eb",
                                borderRadius: "8px",
                                lineHeight: "1.6",
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {comment}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
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
