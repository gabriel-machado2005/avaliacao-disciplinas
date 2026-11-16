import { useEffect, useState } from "react";
import EvaluationResults from "./EvaluationResults";

type ProfessorEvaluation = {
  id: string;
  evaluationPeriod: {
    name: string;
    endDate: string;
  };
  classGroup: {
    code: string;
    discipline: {
      name: string;
    };
    academicTerm: {
      code: string;
    };
  };
};

type Props = {
  role?: "PROFESSOR" | "COORDINATOR" | "ADMIN";
  refreshKey?: number;
};

export default function ProfessorEvaluations({
  role = "PROFESSOR",
  refreshKey = 0,
}: Props) {
  const [evaluations, setEvaluations] = useState<ProfessorEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadEvaluations() {
      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const endpoint =
          role === "PROFESSOR"
            ? "http://localhost:3000/evaluations/professor/my"
            : "http://localhost:3000/evaluations";

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Não foi possível carregar as avaliações.");
        }

        const data: ProfessorEvaluation[] = await response.json();

        if (!controller.signal.aborted) {
          setEvaluations(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar avaliações.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadEvaluations();

    return () => controller.abort();
  }, [role, refreshKey]);

  if (selectedEvaluationId) {
    return (
      <EvaluationResults
        evaluationId={selectedEvaluationId}
        onBack={() => setSelectedEvaluationId(null)}
      />
    );
  }

  if (loading) {
    return <p>Carregando avaliações...</p>;
  }

  if (error) {
    return (
      <p role="alert" className="ui-feedback ui-feedback--error">
        {error}
      </p>
    );
  }

  if (evaluations.length === 0) {
    return <p>Nenhuma avaliação encontrada para suas turmas.</p>;
  }

  return (
    <ul className="evaluation-list">
      {evaluations.map((evaluation) => (
        <li key={evaluation.id} className="evaluation-card ui-card">
          <h4 className="ui-card__title">
            {evaluation.classGroup.discipline.name}
          </h4>

          <p className="ui-card__meta">Turma: {evaluation.classGroup.code}</p>

          <p className="ui-card__meta">
            Semestre: {evaluation.classGroup.academicTerm.code}
          </p>

          <p className="ui-card__meta">
            Período: {evaluation.evaluationPeriod.name}
          </p>

          <div className="ui-card__actions">
            <button
              type="button"
              className="ui-btn ui-btn--secondary"
              onClick={() => setSelectedEvaluationId(evaluation.id)}
            >
              Ver resultados
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
