import { useEffect, useRef, useState, type FormEvent } from "react";
import QuestionnaireDimensions from "./QuestionnaireDimensions";

type Questionnaire = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
};

export default function QuestionnaireManagement() {
  const formRef = useRef<HTMLFormElement>(null);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] =
    useState<Questionnaire | null>(null);
  const [questionnaireToManageId, setQuestionnaireToManageId] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingQuestionnaireId, setEditingQuestionnaireId] = useState<
    string | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingQuestionnaireId, setDeletingQuestionnaireId] = useState<
    string | null
  >(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuestionnaires() {
      try {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
          throw new Error("Faça login novamente para continuar.");
        }

        const response = await fetch("http://localhost:3000/questionnaires", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Não foi possível carregar os questionários.");
        }

        const data: Questionnaire[] = await response.json();

        if (!controller.signal.aborted) {
          setQuestionnaires(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro ao carregar questionários.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadQuestionnaires();

    return () => controller.abort();
  }, []);

  function handleEdit(questionnaire: Questionnaire) {
    setEditingQuestionnaireId(questionnaire.id);
    setName(questionnaire.name);
    setDescription(questionnaire.description ?? "");

    setError("");
    setSuccess("");

    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleCancelEdit() {
    setEditingQuestionnaireId(null);
    setName("");
    setDescription("");

    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || loading) return;

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Informe o nome do questionário.");
      return;
    }

    const isEditing = editingQuestionnaireId !== null;

    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const url = isEditing
        ? `http://localhost:3000/questionnaires/${editingQuestionnaireId}`
        : "http://localhost:3000/questionnaires";

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
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
              ? "Não foi possível atualizar o questionário."
              : "Não foi possível cadastrar o questionário."),
        );
      }

      const savedQuestionnaire: Questionnaire = await response.json();

      setQuestionnaires((previous) =>
        isEditing
          ? previous.map((questionnaire) =>
              questionnaire.id === savedQuestionnaire.id
                ? savedQuestionnaire
                : questionnaire,
            )
          : [...previous, savedQuestionnaire],
      );

      setSelectedQuestionnaire((current) =>
        current?.id === savedQuestionnaire.id
          ? { ...current, ...savedQuestionnaire }
          : current,
      );

      setName("");
      setDescription("");
      setEditingQuestionnaireId(null);

      setSuccess(
        isEditing
          ? "Questionário atualizado com sucesso!"
          : "Questionário cadastrado com sucesso!",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditing
            ? "Erro ao atualizar questionário."
            : "Erro ao cadastrar questionário.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(questionnaire: Questionnaire) {
    if (saving || loading || deletingQuestionnaireId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Deseja realmente excluir o questionário "${questionnaire.name}"?\n\n` +
        "As dimensões e perguntas também serão excluídas.\n" +
        "Esta ação não poderá ser desfeita.",
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingQuestionnaireId(questionnaire.id);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/questionnaires/${questionnaire.id}`,
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

        throw new Error(message || "Não foi possível excluir o questionário.");
      }

      setQuestionnaires((previous) =>
        previous.filter((item) => item.id !== questionnaire.id),
      );

      setSelectedQuestionnaire((current) =>
        current?.id === questionnaire.id ? null : current,
      );

      setQuestionnaireToManageId((current) =>
        current === questionnaire.id ? "" : current,
      );

      if (editingQuestionnaireId === questionnaire.id) {
        setEditingQuestionnaireId(null);
        setName("");
        setDescription("");
      }

      setSuccess("Questionário excluído com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao excluir questionário.",
      );
    } finally {
      setDeletingQuestionnaireId(null);
    }
  }

  return (
    <section>
      <h2>Gerenciamento de questionários</h2>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="evaluation-card ui-form"
      >
        <h3>
          {editingQuestionnaireId
            ? "Editar questionário"
            : "Cadastrar novo questionário"}
        </h3>

        <label htmlFor="questionnaire-name">Nome do questionário</label>

        <input
          id="questionnaire-name"
          type="text"
          placeholder="Ex.: Avaliação de Disciplinas 2027/1"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={150}
          required
          disabled={saving}
        />

        <label htmlFor="questionnaire-description">Descrição (opcional)</label>

        <textarea
          id="questionnaire-description"
          rows={3}
          placeholder="Descreva o objetivo do questionário."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={saving}
        />

        <div className="ui-form__actions">
          <button
            type="submit"
            className="ui-btn ui-btn--primary"
            disabled={saving || loading}
          >
            {saving
              ? editingQuestionnaireId
                ? "Salvando..."
                : "Cadastrando..."
              : editingQuestionnaireId
                ? "Salvar alterações"
                : "Cadastrar questionário"}
          </button>

          {editingQuestionnaireId && (
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

      <h3>Questionários cadastrados</h3>

      {loading ? (
        <p>Carregando questionários...</p>
      ) : questionnaires.length === 0 ? (
        <p>Nenhum questionário cadastrado.</p>
      ) : (
        <ul className="evaluation-list">
          {questionnaires.map((questionnaire) => (
            <li
              key={questionnaire.id}
              className="evaluation-card questionnaire-card"
            >
              <div className="questionnaire-card__header">
                <h4 className="questionnaire-card__name">
                  {questionnaire.name}
                </h4>

                <span
                  className={`questionnaire-card__status ${
                    questionnaire.active
                      ? "questionnaire-card__status--active"
                      : "questionnaire-card__status--inactive"
                  }`}
                >
                  {questionnaire.active ? "Ativo" : "Inativo"}
                </span>
              </div>

              {questionnaire.description && (
                <p className="questionnaire-card__description">
                  {questionnaire.description}
                </p>
              )}

              <div className="questionnaire-card__actions">
                <button
                  type="button"
                  className="questionnaire-card__action questionnaire-card__action--primary"
                  onClick={() => handleEdit(questionnaire)}
                  disabled={
                    saving || loading || deletingQuestionnaireId !== null
                  }
                >
                  Editar
                </button>

                <button
                  type="button"
                  className="questionnaire-card__action questionnaire-card__action--danger"
                  onClick={() => void handleDelete(questionnaire)}
                  disabled={
                    saving || loading || deletingQuestionnaireId !== null
                  }
                >
                  {deletingQuestionnaireId === questionnaire.id
                    ? "Excluindo..."
                    : "Excluir"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && questionnaires.length > 0 && (
        <div className="evaluation-card ui-card questionnaire-manage">
          <h3>Gerenciar dimensões</h3>

          <p>
            Selecione um questionário para gerenciar suas dimensões e perguntas.
          </p>

          <div className="questionnaire-manage__controls">
            <div className="questionnaire-manage__field">
              <label htmlFor="questionnaire-manage-select">Questionário</label>

              <select
                id="questionnaire-manage-select"
                className="questionnaire-manage__select"
                value={questionnaireToManageId}
                onChange={(event) => {
                  setQuestionnaireToManageId(event.target.value);
                  setSelectedQuestionnaire(null);
                }}
                disabled={saving || deletingQuestionnaireId !== null}
              >
                <option value="">Selecione um questionário</option>

                {questionnaires.map((questionnaire) => (
                  <option key={questionnaire.id} value={questionnaire.id}>
                    {questionnaire.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="ui-btn ui-btn--primary"
              disabled={
                !questionnaireToManageId ||
                saving ||
                deletingQuestionnaireId !== null
              }
              onClick={() => {
                const questionnaire = questionnaires.find(
                  (item) => item.id === questionnaireToManageId,
                );

                if (!questionnaire) return;

                setSelectedQuestionnaire((current) =>
                  current?.id === questionnaire.id ? null : questionnaire,
                );
              }}
            >
              {selectedQuestionnaire?.id === questionnaireToManageId
                ? "Fechar gerenciamento"
                : "Gerenciar dimensões"}
            </button>
          </div>
        </div>
      )}

      {selectedQuestionnaire && (
        <div style={{ marginTop: "24px" }}>
          <QuestionnaireDimensions
            key={selectedQuestionnaire.id}
            questionnaireId={selectedQuestionnaire.id}
            questionnaireName={selectedQuestionnaire.name}
          />
        </div>
      )}
    </section>
  );
}
