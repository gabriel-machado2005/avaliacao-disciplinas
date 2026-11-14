import { useEffect, useState, type FormEvent } from "react";
import QuestionnaireDimensions from "./QuestionnaireDimensions";

type Questionnaire = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
};

export default function QuestionnaireManagement() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] =
    useState<Questionnaire | null>(null);

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

    window.scrollTo({ top: 0, behavior: "smooth" });
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
        onSubmit={handleSubmit}
        className="evaluation-card"
        style={{ display: "grid", gap: "12px" }}
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

        <button type="submit" disabled={saving || loading}>
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
            onClick={handleCancelEdit}
            disabled={saving}
            style={{
              backgroundColor: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "10px 16px",
              fontWeight: 600,
            }}
          >
            Cancelar edição
          </button>
        )}
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
            <li key={questionnaire.id} className="evaluation-card">
              <strong>{questionnaire.name}</strong>

              {questionnaire.description && <p>{questionnaire.description}</p>}

              <p>Situação: {questionnaire.active ? "Ativo" : "Inativo"}</p>

              <button
                type="button"
                onClick={() => handleEdit(questionnaire)}
                disabled={saving || loading || deletingQuestionnaireId !== null}
                style={{
                  marginRight: "8px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "1px solid #2563eb",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontWeight: 600,
                }}
              >
                Editar
              </button>

              <button
                type="button"
                onClick={() => void handleDelete(questionnaire)}
                disabled={saving || loading || deletingQuestionnaireId !== null}
                style={{
                  marginRight: "8px",
                  backgroundColor: "#b91c1c",
                  color: "#ffffff",
                  border: "1px solid #b91c1c",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontWeight: 600,
                }}
              >
                {deletingQuestionnaireId === questionnaire.id
                  ? "Excluindo..."
                  : "Excluir"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedQuestionnaire((current) =>
                    current?.id === questionnaire.id ? null : questionnaire,
                  )
                }
                disabled={saving || loading || deletingQuestionnaireId !== null}
              >
                {selectedQuestionnaire?.id === questionnaire.id
                  ? "Fechar gerenciamento"
                  : "Gerenciar dimensões"}
              </button>
            </li>
          ))}
        </ul>
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
