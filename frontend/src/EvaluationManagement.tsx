import { useEffect, useRef, useState, type FormEvent } from "react";
import EvaluationResults from "./EvaluationResults";

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

type RegisteredEvaluation = {
  id: string;
  evaluationPeriod: {
    id: string;
    name: string;
  };
  classGroup: {
    id: string;
    code: string;
    discipline?: {
      name: string;
    };
    academicTerm?: {
      code: string;
    };
  };
  questionnaire: {
    id: string;
    name: string;
  };
  minResponsesForResults: number | null;
};

export default function EvaluationManagement({
  role,
}: {
  role: "ADMIN" | "COORDINATOR";
}) {
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);

  const [registeredEvaluations, setRegisteredEvaluations] = useState<
    RegisteredEvaluation[]
  >([]);

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<
    string | null
  >(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [evaluationPeriodId, setEvaluationPeriodId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [questionnaireId, setQuestionnaireId] = useState("");
  const [minResponses, setMinResponses] = useState(3);
  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(
    null,
  );

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

  useEffect(() => {
    const controller = new AbortController();

    async function loadRegisteredEvaluations() {
      setListLoading(true);
      setListError("");

      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const response = await fetch("http://localhost:3000/evaluations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            "Não foi possível carregar as avaliações cadastradas.",
          );
        }

        const data: RegisteredEvaluation[] = await response.json();

        if (!controller.signal.aborted) {
          setRegisteredEvaluations(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setListError(
            err instanceof Error
              ? err.message
              : "Erro ao carregar as avaliações.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setListLoading(false);
        }
      }
    }

    void loadRegisteredEvaluations();

    return () => controller.abort();
  }, [refreshKey]);

  function handleEdit(evaluation: RegisteredEvaluation) {
    if (saving || loading || listLoading) return;

    setEditingEvaluationId(evaluation.id);
    setEvaluationPeriodId(evaluation.evaluationPeriod.id);
    setClassGroupId(evaluation.classGroup.id);
    setQuestionnaireId(evaluation.questionnaire.id);
    setMinResponses(evaluation.minResponsesForResults ?? 3);

    setError("");
    setSuccess("");

    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleCancelEdit() {
    if (saving) return;

    setEditingEvaluationId(null);
    setEvaluationPeriodId("");
    setClassGroupId("");
    setQuestionnaireId("");
    setMinResponses(3);

    setError("");
    setSuccess("");
  }

  async function handleDelete(evaluation: RegisteredEvaluation) {
    if (role !== "ADMIN" || saving || listLoading) {
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza de que deseja excluir a avaliação da turma "${evaluation.classGroup.code}" ` +
        `do período "${evaluation.evaluationPeriod.name}"?\n\n` +
        "A exclusão será permitida somente se não existirem estudantes habilitados ou respostas vinculadas.\n\n" +
        "Esta operação não poderá ser desfeita.",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/evaluations/${evaluation.id}`,
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

        throw new Error(message || "Não foi possível excluir a avaliação.");
      }

      setRegisteredEvaluations((previous) =>
        previous.filter((item) => item.id !== evaluation.id),
      );

      setSuccess("Avaliação excluída com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao excluir a avaliação.",
      );
    } finally {
      setSaving(false);
    }
  }

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

      const isEditing = editingEvaluationId !== null;

      const url = isEditing
        ? `http://localhost:3000/evaluations/${editingEvaluationId}`
        : "http://localhost:3000/evaluations";

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
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

        throw new Error(
          message ||
            (isEditing
              ? "Não foi possível atualizar a avaliação."
              : "Não foi possível cadastrar a avaliação."),
        );
      }

      setEvaluationPeriodId("");
      setClassGroupId("");
      setQuestionnaireId("");
      setMinResponses(3);
      setEditingEvaluationId(null);

      setSuccess(
        isEditing
          ? "Avaliação atualizada com sucesso!"
          : "Avaliação cadastrada com sucesso!",
      );

      setRefreshKey((previous) => previous + 1);
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

  const canSubmit =
    editingEvaluationId !== null ? !loading && !listLoading : canCreate;
  if (selectedEvaluationId !== null) {
    return (
      <EvaluationResults
        evaluationId={selectedEvaluationId}
        onBack={() => setSelectedEvaluationId(null)}
      />
    );
  }
  return (
    <section>
      <h2>Gerenciamento de avaliações</h2>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="evaluation-card ui-form"
        style={{ display: "grid", gap: "12px" }}
      >
        <h3>
          {editingEvaluationId
            ? "Editar avaliação"
            : "Cadastrar nova avaliação"}
        </h3>

        <label htmlFor="evaluation-period">Período de avaliação</label>

        <select
          id="evaluation-period"
          value={evaluationPeriodId}
          onChange={(event) => setEvaluationPeriodId(event.target.value)}
          required
          disabled={saving || !canSubmit}
        >
          <option value="">Selecione um período</option>

          {periods
            .filter(
              (period) =>
                period.active ||
                (editingEvaluationId !== null &&
                  period.id === evaluationPeriodId),
            )
            .map((period) => (
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

          {questionnaires
            .filter(
              (questionnaire) =>
                questionnaire.active ||
                (editingEvaluationId !== null &&
                  questionnaire.id === questionnaireId),
            )
            .map((questionnaire) => (
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

        <div className="ui-form__actions">
          <button
            type="submit"
            className="ui-btn ui-btn--primary"
            disabled={saving || !canSubmit}
          >
            {saving
              ? "Salvando..."
              : editingEvaluationId
                ? "Salvar alterações"
                : "Cadastrar avaliação"}
          </button>

          {editingEvaluationId && (
            <button
              type="button"
              className="ui-btn ui-btn--secondary"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {editingEvaluationId === null && !canCreate && !loading && !error && (
        <p>
          É necessário ter períodos ativos, turmas e questionários ativos
          cadastrados.
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

      <h3 style={{ marginTop: "32px" }}>Gerenciar avaliações cadastradas</h3>

      {listError && (
        <p role="alert" className="ui-feedback ui-feedback--error">
          {listError}
        </p>
      )}

      {listLoading ? (
        <p>Carregando avaliações...</p>
      ) : registeredEvaluations.length === 0 ? (
        <p>Nenhuma avaliação cadastrada.</p>
      ) : (
        <ul className="evaluation-list">
          {registeredEvaluations.map((evaluation) => (
            <li key={evaluation.id} className="evaluation-card ui-card">
              <h4 className="ui-card__title">
                {evaluation.classGroup.discipline?.name ??
                  "Disciplina não informada"}
              </h4>

              <p className="ui-card__meta">
                Turma: {evaluation.classGroup.code}
              </p>

              {evaluation.classGroup.academicTerm && (
                <p className="ui-card__meta">
                  Semestre: {evaluation.classGroup.academicTerm.code}
                </p>
              )}

              <p className="ui-card__meta">
                Período: {evaluation.evaluationPeriod.name}
              </p>

              <p className="ui-card__meta">
                Questionário: {evaluation.questionnaire.name}
              </p>

              <p className="ui-card__meta">
                Mínimo de respostas:{" "}
                {evaluation.minResponsesForResults ?? "Não definido"}
              </p>

              <div className="ui-card__actions">
                <button
                  type="button"
                  className="ui-btn ui-btn--primary"
                  onClick={() => handleEdit(evaluation)}
                  disabled={saving || loading || listLoading}
                >
                  Editar
                </button>

                <button
                  type="button"
                  className="ui-btn ui-btn--secondary"
                  onClick={() => setSelectedEvaluationId(evaluation.id)}
                  disabled={saving || listLoading}
                >
                  Ver resultados
                </button>

                {role === "ADMIN" && (
                  <button
                    type="button"
                    className="ui-btn ui-btn--danger"
                    onClick={() => void handleDelete(evaluation)}
                    disabled={saving || listLoading}
                  >
                    Excluir
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
