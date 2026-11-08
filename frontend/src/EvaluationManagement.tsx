import { useEffect, useState, type FormEvent } from "react";

type EvaluationPeriod = {
  id: string;
  name: string;
  active: boolean;
};

type ClassGroup = {
  id: string;
  code: string;
  discipline?: {
    name: string;
  };
};

type Questionnaire = {
  id: string;
  name: string;
  active: boolean;
};

export default function EvaluationManagement() {
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);

  const [evaluationPeriodId, setEvaluationPeriodId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [questionnaireId, setQuestionnaireId] = useState("");
  const [minResponses, setMinResponses] = useState(3);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

        const [periodsResponse, classesResponse, questionnairesResponse] =
          await Promise.all([
            fetch("http://localhost:3000/evaluations/periods", {
              headers,
              signal: controller.signal,
            }),
            fetch("http://localhost:3000/academic/classes", {
              headers,
              signal: controller.signal,
            }),
            fetch("http://localhost:3000/questionnaires", {
              headers,
              signal: controller.signal,
            }),
          ]);

        if (
          !periodsResponse.ok ||
          !classesResponse.ok ||
          !questionnairesResponse.ok
        ) {
          throw new Error("Não foi possível carregar os dados das avaliações.");
        }

        const periodsData: EvaluationPeriod[] = await periodsResponse.json();

        const classesData: ClassGroup[] = await classesResponse.json();

        const questionnairesData: Questionnaire[] =
          await questionnairesResponse.json();

        if (!controller.signal.aborted) {
          setPeriods(periodsData);
          setClasses(classesData);
          setQuestionnaires(questionnairesData);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || loading) return;

    setError("");
    setSuccess("");

    if (!evaluationPeriodId || !classGroupId || !questionnaireId) {
      setError("Preencha todos os campos.");
      return;
    }

    if (!Number.isInteger(minResponses) || minResponses < 2) {
      setError("Informe pelo menos 2 respostas para divulgação.");
      return;
    }

    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch("http://localhost:3000/evaluations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          evaluationPeriodId,
          classGroupId,
          questionnaireId,
          minResponsesForResults: minResponses,
        }),
      });

      if (!response.ok) {
        const data: { message?: string | string[] } = await response
          .json()
          .catch(() => ({}));

        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;

        throw new Error(message || "Não foi possível cadastrar a avaliação.");
      }

      setEvaluationPeriodId("");
      setClassGroupId("");
      setQuestionnaireId("");
      setMinResponses(3);

      setSuccess("Avaliação cadastrada com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar avaliação.",
      );
    } finally {
      setSaving(false);
    }
  }

  const activePeriods = periods.filter((period) => period.active);
  const activeQuestionnaires = questionnaires.filter(
    (questionnaire) => questionnaire.active,
  );

  const canCreate =
    !loading &&
    activePeriods.length > 0 &&
    classes.length > 0 &&
    activeQuestionnaires.length > 0;

  return (
    <section>
      <h2>Gerenciamento de avaliações</h2>

      <form
        onSubmit={handleSubmit}
        className="evaluation-card"
        style={{ display: "grid", gap: "12px" }}
      >
        <h3>Cadastrar nova avaliação</h3>

        <label htmlFor="evaluation-period">Período de avaliação</label>

        <select
          id="evaluation-period"
          value={evaluationPeriodId}
          onChange={(event) => setEvaluationPeriodId(event.target.value)}
          required
          disabled={saving || !canCreate}
        >
          <option value="">Selecione um período</option>

          {activePeriods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.name}
            </option>
          ))}
        </select>

        <label htmlFor="evaluation-class">Turma</label>

        <select
          id="evaluation-class"
          value={classGroupId}
          onChange={(event) => setClassGroupId(event.target.value)}
          required
          disabled={saving || !canCreate}
        >
          <option value="">Selecione uma turma</option>

          {classes.map((classGroup) => (
            <option key={classGroup.id} value={classGroup.id}>
              {classGroup.code}
              {classGroup.discipline?.name
                ? ` - ${classGroup.discipline.name}`
                : ""}
            </option>
          ))}
        </select>

        <label htmlFor="evaluation-questionnaire">Questionário</label>

        <select
          id="evaluation-questionnaire"
          value={questionnaireId}
          onChange={(event) => setQuestionnaireId(event.target.value)}
          required
          disabled={saving || !canCreate}
        >
          <option value="">Selecione um questionário</option>

          {activeQuestionnaires.map((questionnaire) => (
            <option key={questionnaire.id} value={questionnaire.id}>
              {questionnaire.name}
            </option>
          ))}
        </select>

        <label htmlFor="evaluation-min-responses">
          Quantidade mínima de respostas para divulgar resultados
        </label>

        <input
          id="evaluation-min-responses"
          type="number"
          min={2}
          step={1}
          value={minResponses}
          onChange={(event) => setMinResponses(Number(event.target.value))}
          required
          disabled={saving}
        />

        <p
          style={{
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          Os resultados só serão divulgados após o encerramento do período e
          quando o mínimo de respostas for atingido.
        </p>

        <button type="submit" disabled={saving || !canCreate}>
          {saving ? "Cadastrando..." : "Cadastrar avaliação"}
        </button>
      </form>

      {!canCreate && !loading && !error && (
        <p>
          É necessário ter períodos ativos, turmas e questionários ativos
          cadastrados.
        </p>
      )}

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
    </section>
  );
}
