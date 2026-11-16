import { useEffect, useState, type FormEvent } from "react";

type Student = {
  id: string;
  name: string;
};

type Evaluation = {
  id: string;
  classGroup?: {
    code: string;
  };
  evaluationPeriod?: {
    name: string;
  };
};

type Eligibility = {
  id: string;
  completed: boolean;
  createdAt: string;
  student: Student;
};

export default function EvaluationEligibilities() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [eligibilities, setEligibilities] = useState<Eligibility[]>([]);

  const [evaluationId, setEvaluationId] = useState("");
  const [studentId, setStudentId] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingEligibilities, setLoadingEligibilities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokingEligibilityId, setRevokingEligibilityId] = useState<
    string | null
  >(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const [error, setError] = useState("");
  const [eligibilitiesError, setEligibilitiesError] = useState("");
  const [success, setSuccess] = useState("");

  // Carrega avaliações e estudantes.
  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [evaluationsResponse, studentsResponse] = await Promise.all([
          fetch("http://localhost:3000/evaluations", {
            headers,
            signal: controller.signal,
          }),
          fetch("http://localhost:3000/users/students", {
            headers,
            signal: controller.signal,
          }),
        ]);

        if (!evaluationsResponse.ok || !studentsResponse.ok) {
          throw new Error(
            "Não foi possível carregar as avaliações ou os estudantes.",
          );
        }

        const evaluationsData: Evaluation[] = await evaluationsResponse.json();

        const studentsData: Student[] = await studentsResponse.json();

        if (!controller.signal.aborted) {
          setEvaluations(evaluationsData);
          setStudents(studentsData);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar os dados.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => controller.abort();
  }, []);

  // Consulta os estudantes habilitados da avaliação selecionada.
  useEffect(() => {
    if (!evaluationId) return;

    const controller = new AbortController();

    async function loadEligibilities() {
      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const response = await fetch(
          `http://localhost:3000/evaluations/${evaluationId}/eligibilities`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            "Não foi possível carregar os estudantes habilitados.",
          );
        }

        const data: Eligibility[] = await response.json();

        if (!controller.signal.aborted) {
          setEligibilities(data);
          setEligibilitiesError("");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setEligibilitiesError(
            err instanceof Error
              ? err.message
              : "Erro ao carregar habilitações.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingEligibilities(false);
        }
      }
    }

    void loadEligibilities();

    return () => controller.abort();
  }, [evaluationId, refreshKey]);

  // Cadastra uma nova habilitação.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || loadingEligibilities) return;

    setError("");
    setSuccess("");

    if (!evaluationId || !studentId) {
      setError("Selecione uma avaliação e um estudante.");
      return;
    }

    if (
      eligibilities.some((eligibility) => eligibility.student.id === studentId)
    ) {
      setError("Este estudante já está habilitado para esta avaliação.");
      return;
    }

    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        "http://localhost:3000/evaluations/eligibilities",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            evaluationId,
            studentId,
          }),
        },
      );

      if (!response.ok) {
        const data: { message?: string | string[] } = await response
          .json()
          .catch(() => ({}));

        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;

        throw new Error(message || "Não foi possível habilitar o estudante.");
      }

      setStudentId("");
      setSuccess("Estudante habilitado com sucesso!");

      // Atualiza a listagem após o cadastro.
      setLoadingEligibilities(true);
      setRefreshKey((previous) => previous + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao habilitar estudante.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(eligibility: Eligibility) {
    if (
      !evaluationId ||
      eligibility.completed ||
      saving ||
      loadingEligibilities ||
      revokingEligibilityId !== null
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Deseja desabilitar o estudante "${eligibility.student.name}" desta avaliação?\n\n` +
        "O estudante perderá o acesso a esta avaliação.\n\n" +
        "A habilitação poderá ser cadastrada novamente, desde que o estudante ainda não tenha respondido.",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setRevokingEligibilityId(eligibility.id);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/evaluations/eligibilities/${eligibility.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const data: { message?: string | string[] } = await response
          .json()
          .catch(() => ({}));

        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;

        throw new Error(message || "Não foi possível desabilitar o estudante.");
      }

      setEligibilities((previous) =>
        previous.filter((item) => item.id !== eligibility.id),
      );

      setSuccess("Estudante desabilitado com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao desabilitar estudante.",
      );
    } finally {
      setRevokingEligibilityId(null);
    }
  }

  return (
    <section>
      <h2>Gerenciamento de estudantes habilitados</h2>

      <p>Selecione uma avaliação e o estudante que poderá respondê-la.</p>

      <form
        onSubmit={handleSubmit}
        className="evaluation-card"
        style={{
          display: "grid",
          gap: "12px",
        }}
      >
        <h3>Habilitar estudante</h3>

        <label htmlFor="eligibility-evaluation">Avaliação</label>

        <select
          id="eligibility-evaluation"
          value={evaluationId}
          onChange={(event) => {
            const selectedId = event.target.value;

            setEvaluationId(selectedId);
            setStudentId("");
            setEligibilities([]);
            setEligibilitiesError("");
            setSuccess("");
            setError("");
            setLoadingEligibilities(Boolean(selectedId));
          }}
          required
          disabled={loading || saving}
        >
          <option value="">Selecione uma avaliação</option>

          {evaluations.map((evaluation) => (
            <option key={evaluation.id} value={evaluation.id}>
              {evaluation.classGroup?.code ?? "Avaliação"} —{" "}
              {evaluation.evaluationPeriod?.name ?? evaluation.id.slice(0, 8)}
            </option>
          ))}
        </select>

        <label htmlFor="eligibility-student">Estudante</label>

        <select
          id="eligibility-student"
          value={studentId}
          onChange={(event) => {
            setStudentId(event.target.value);
            setSuccess("");
            setError("");
          }}
          required
          disabled={loading || saving || loadingEligibilities}
        >
          <option value="">Selecione um estudante</option>

          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={
            loading ||
            saving ||
            loadingEligibilities ||
            !evaluationId ||
            !studentId
          }
        >
          {saving ? "Habilitando..." : "Habilitar estudante"}
        </button>
      </form>

      {loading && <p>Carregando dados...</p>}

      {error && (
        <p role="alert" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      {success && (
        <p role="status" style={{ color: "#15803d" }}>
          {success}
        </p>
      )}

      <div style={{ marginTop: "24px" }}>
        <h3>Estudantes habilitados</h3>

        {!evaluationId ? (
          <p>Selecione uma avaliação para visualizar os estudantes.</p>
        ) : loadingEligibilities ? (
          <p>Carregando estudantes habilitados...</p>
        ) : eligibilitiesError ? (
          <p role="alert" style={{ color: "#dc2626" }}>
            {eligibilitiesError}
          </p>
        ) : eligibilities.length === 0 ? (
          <p>Nenhum estudante habilitado para esta avaliação.</p>
        ) : (
          <>
            <p>
              Total de estudantes habilitados:{" "}
              <strong>{eligibilities.length}</strong>
            </p>

            <ul className="evaluation-list">
              {eligibilities.map((eligibility) => (
                <li
                  key={eligibility.id}
                  className="evaluation-card eligibility-card"
                >
                  <div className="eligibility-card__header">
                    <h4 className="eligibility-card__name">
                      {eligibility.student.name}
                    </h4>

                    <span
                      className={`eligibility-card__status ${
                        eligibility.completed
                          ? "eligibility-card__status--completed"
                          : "eligibility-card__status--pending"
                      }`}
                    >
                      {eligibility.completed ? "Concluída" : "Pendente"}
                    </span>
                  </div>

                  <p className="eligibility-card__date">
                    Habilitado em:{" "}
                    {new Date(eligibility.createdAt).toLocaleString("pt-BR")}
                  </p>
                  {!eligibility.completed && (
                    <div className="eligibility-card__actions">
                      <button
                        type="button"
                        className="eligibility-card__revoke"
                        onClick={() => void handleRevoke(eligibility)}
                        disabled={
                          saving ||
                          loadingEligibilities ||
                          revokingEligibilityId !== null
                        }
                      >
                        {revokingEligibilityId === eligibility.id
                          ? "Desabilitando..."
                          : "Desabilitar"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
