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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || loading) return;

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Informe o nome do questionário.");
      return;
    }

    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch("http://localhost:3000/questionnaires", {
        method: "POST",
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
          message || "Não foi possível cadastrar o questionário.",
        );
      }

      const createdQuestionnaire: Questionnaire = await response.json();

      setQuestionnaires((previous) => [...previous, createdQuestionnaire]);

      setName("");
      setDescription("");

      setSuccess("Questionário cadastrado com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar questionário.",
      );
    } finally {
      setSaving(false);
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
        <h3>Cadastrar novo questionário</h3>

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
          {saving ? "Cadastrando..." : "Cadastrar questionário"}
        </button>
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
                onClick={() =>
                  setSelectedQuestionnaire((current) =>
                    current?.id === questionnaire.id ? null : questionnaire,
                  )
                }
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
