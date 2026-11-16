import { useCallback, useEffect, useState, type FormEvent } from "react";
import QuestionnaireQuestions from "./QuestionnaireQuestions";

type Props = {
  questionnaireId: string;
  questionnaireName: string;
};

type Question = {
  id: string;
  text: string;
  type: "SCALE" | "SINGLE_CHOICE" | "TEXT";
  required: boolean;
  order: number;
  scaleMin?: number | null;
  scaleMax?: number | null;
  options?: string[] | null;
};

type Dimension = {
  id: string;
  name: string;
  description?: string | null;
  order: number;
  questions: Question[];
};

type QuestionnaireDetails = {
  id: string;
  name: string;
  dimensions: Dimension[];
};

export default function QuestionnaireDimensions({
  questionnaireId,
  questionnaireName,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState("1");

  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(
    null,
  );

  const selectedDimension = dimensions.find(
    (dimension) => dimension.id === selectedDimensionId,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchDimensions = useCallback(
    async (signal?: AbortSignal): Promise<Dimension[]> => {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/questionnaires/${questionnaireId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        },
      );

      if (!response.ok) {
        throw new Error(
          "Não foi possível carregar as dimensões do questionário.",
        );
      }

      const data: QuestionnaireDetails = await response.json();

      return data.dimensions ?? [];
    },
    [questionnaireId],
  );

  // Atualização manual após cadastrar ou solicitar nova tentativa.
  const loadDimensions = async () => {
    setLoading(true);
    setListError("");

    try {
      const result = await fetchDimensions();
      setDimensions(result);
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : "Erro ao carregar dimensões.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Carregamento inicial do questionário.
  useEffect(() => {
    const controller = new AbortController();

    void fetchDimensions(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setDimensions(result);
          setListError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setListError(
            err instanceof Error ? err.message : "Erro ao carregar dimensões.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [fetchDimensions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Informe o nome da dimensão.");
      return;
    }

    const orderNumber = Number(order);

    if (
      order.trim() === "" ||
      !Number.isInteger(orderNumber) ||
      orderNumber < 0
    ) {
      setError("A ordem deve ser um número inteiro maior ou igual a 0.");
      return;
    }

    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/questionnaires/${questionnaireId}/dimensions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            order: orderNumber,
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

        throw new Error(message || "Não foi possível cadastrar a dimensão.");
      }

      setName("");
      setDescription("");
      setOrder(String(orderNumber + 1));

      setSuccess("Dimensão cadastrada com sucesso!");

      // Atualiza a listagem após cadastrar.
      await loadDimensions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar dimensão.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3>Gerenciamento de dimensões</h3>

      <p>
        Questionário: <strong>{questionnaireName}</strong>
      </p>

      <form onSubmit={handleSubmit} className="evaluation-card ui-form">
        <h3>Adicionar nova dimensão</h3>

        <label htmlFor="dimension-name">Nome da dimensão</label>

        <input
          id="dimension-name"
          type="text"
          placeholder="Ex.: Organização da Disciplina"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={150}
          required
          disabled={saving}
        />

        <label htmlFor="dimension-description">Descrição (opcional)</label>

        <textarea
          id="dimension-description"
          rows={3}
          placeholder="Descreva o objetivo desta dimensão."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={saving}
        />

        <label htmlFor="dimension-order">Ordem de apresentação</label>

        <input
          id="dimension-order"
          type="number"
          min={0}
          step={1}
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          required
          disabled={saving}
        />

        <div className="ui-form__actions">
          <button
            type="submit"
            className="ui-btn ui-btn--primary"
            disabled={saving}
          >
            {saving ? "Cadastrando..." : "Adicionar dimensão"}
          </button>
        </div>
      </form>

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

      <h3 style={{ marginTop: "24px" }}>Dimensões cadastradas</h3>

      {loading ? (
        <p>Carregando dimensões...</p>
      ) : listError ? (
        <>
          <p role="alert" className="ui-feedback ui-feedback--error">
            {listError}
          </p>

          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            onClick={() => {
              setLoading(true);
              setListError("");
              void loadDimensions();
            }}
          >
            Tentar novamente
          </button>
        </>
      ) : dimensions.length === 0 ? (
        <p>Nenhuma dimensão cadastrada neste questionário.</p>
      ) : (
        <ul className="evaluation-list">
          {dimensions.map((dimension) => (
            <li key={dimension.id} className="evaluation-card ui-card">
              <h4 className="ui-card__title">{dimension.name}</h4>

              {dimension.description && (
                <p className="ui-card__meta">{dimension.description}</p>
              )}

              <p className="ui-card__meta">Ordem: {dimension.order}</p>

              <p className="ui-card__meta">
                Perguntas cadastradas: {dimension.questions?.length ?? 0}
              </p>

              {dimension.questions?.length > 0 && (
                <div className="ui-question-section">
                  <h5 className="ui-question-section__title">
                    Perguntas desta dimensão
                  </h5>

                  <ol className="ui-question-list">
                    {dimension.questions.map((question) => (
                      <li key={question.id} className="ui-question-item">
                        <p className="ui-question-item__text">
                          {question.text}
                        </p>

                        <div className="ui-question-item__details">
                          <span>
                            Tipo:{" "}
                            {question.type === "SCALE"
                              ? "Escala numérica"
                              : question.type === "SINGLE_CHOICE"
                                ? "Múltipla escolha"
                                : "Resposta aberta"}
                          </span>

                          <span>Ordem: {question.order}</span>

                          <span>
                            Obrigatória: {question.required ? "Sim" : "Não"}
                          </span>
                        </div>

                        {question.type === "SCALE" && (
                          <p className="ui-question-item__extra">
                            Escala: {question.scaleMin} a {question.scaleMax}
                          </p>
                        )}

                        {question.type === "SINGLE_CHOICE" && (
                          <div className="ui-question-item__extra">
                            <p>Alternativas:</p>

                            <ul className="ui-question-item__options">
                              {(question.options ?? []).map((option, index) => (
                                <li key={`${question.id}-${index}`}>
                                  {option}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {question.type === "TEXT" && (
                          <p className="ui-question-item__extra">
                            Resposta em texto livre.
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="ui-card__actions">
                <button
                  type="button"
                  className="ui-btn ui-btn--secondary"
                  onClick={() =>
                    setSelectedDimensionId((current) =>
                      current === dimension.id ? null : dimension.id,
                    )
                  }
                >
                  {selectedDimensionId === dimension.id
                    ? "Fechar gerenciamento"
                    : "Gerenciar perguntas"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedDimension && (
        <div style={{ marginTop: "24px" }}>
          <QuestionnaireQuestions
            key={selectedDimension.id}
            dimensionId={selectedDimension.id}
            dimensionName={selectedDimension.name}
            onCreated={() => void loadDimensions()}
          />
        </div>
      )}
    </section>
  );
}
