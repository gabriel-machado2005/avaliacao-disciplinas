import { useState, type FormEvent } from "react";

type QuestionType = "SCALE" | "SINGLE_CHOICE" | "TEXT";

type Props = {
  dimensionId: string;
  dimensionName: string;
  onCreated?: () => void;
};

export default function QuestionnaireQuestions({
  dimensionId,
  dimensionName,
  onCreated,
}: Props) {
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("SCALE");
  const [required, setRequired] = useState(true);
  const [order, setOrder] = useState("1");

  const [scaleMin, setScaleMin] = useState("1");
  const [scaleMax, setScaleMax] = useState("5");
  const [options, setOptions] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");

    if (!text.trim()) {
      setError("Informe o enunciado da pergunta.");
      return;
    }

    const orderNumber = Number(order);

    if (
      order.trim() === "" ||
      !Number.isInteger(orderNumber) ||
      orderNumber < 0
    ) {
      setError("Informe uma ordem inteira maior ou igual a zero.");
      return;
    }

    const payload: {
      text: string;
      type: QuestionType;
      required: boolean;
      order: number;
      scaleMin?: number;
      scaleMax?: number;
      options?: string[];
    } = {
      text: text.trim(),
      type,
      required,
      order: orderNumber,
    };

    if (type === "SCALE") {
      const min = Number(scaleMin);
      const max = Number(scaleMax);

      if (
        scaleMin.trim() === "" ||
        scaleMax.trim() === "" ||
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        min >= max
      ) {
        setError(
          "Informe valores inteiros para a escala, com mínimo menor que o máximo.",
        );
        return;
      }

      payload.scaleMin = min;
      payload.scaleMax = max;
    }

    if (type === "SINGLE_CHOICE") {
      const alternatives = options
        .split("\n")
        .map((option) => option.trim())
        .filter((option) => option.length > 0);

      if (alternatives.length < 2) {
        setError("Cadastre pelo menos duas alternativas.");
        return;
      }

      if (new Set(alternatives).size !== alternatives.length) {
        setError("As alternativas não podem ser repetidas.");
        return;
      }

      payload.options = alternatives;
    }

    setSaving(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Faça login novamente para continuar.");
      }

      const response = await fetch(
        `http://localhost:3000/questionnaires/dimensions/${dimensionId}/questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const data: { message?: string | string[] } = await response
          .json()
          .catch(() => ({}));

        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;

        throw new Error(message || "Não foi possível cadastrar a pergunta.");
      }

      setText("");
      setOrder(String(orderNumber + 1));
      setOptions("");

      setSuccess("Pergunta cadastrada com sucesso!");

      onCreated?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar pergunta.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3>Gerenciamento de perguntas</h3>

      <p>
        Dimensão: <strong>{dimensionName}</strong>
      </p>

      <form
        onSubmit={handleSubmit}
        className="evaluation-card"
        style={{
          display: "grid",
          gap: "12px",
        }}
      >
        <h3>Adicionar nova pergunta</h3>

        <label htmlFor="question-text">Enunciado da pergunta</label>

        <textarea
          id="question-text"
          rows={3}
          placeholder="Ex.: A disciplina foi bem organizada?"
          value={text}
          onChange={(event) => setText(event.target.value)}
          required
          disabled={saving}
        />

        <label htmlFor="question-type">Tipo de pergunta</label>

        <select
          id="question-type"
          value={type}
          onChange={(event) => setType(event.target.value as QuestionType)}
          disabled={saving}
        >
          <option value="SCALE">Escala numérica</option>
          <option value="SINGLE_CHOICE">Múltipla escolha</option>
          <option value="TEXT">Resposta aberta</option>
        </select>

        {type === "SCALE" && (
          <>
            <label htmlFor="scale-min">Valor mínimo da escala</label>

            <input
              id="scale-min"
              type="number"
              step={1}
              value={scaleMin}
              onChange={(event) => setScaleMin(event.target.value)}
              required
              disabled={saving}
            />

            <label htmlFor="scale-max">Valor máximo da escala</label>

            <input
              id="scale-max"
              type="number"
              step={1}
              value={scaleMax}
              onChange={(event) => setScaleMax(event.target.value)}
              required
              disabled={saving}
            />
          </>
        )}

        {type === "SINGLE_CHOICE" && (
          <>
            <label htmlFor="question-options">
              Alternativas (uma por linha)
            </label>

            <textarea
              id="question-options"
              rows={6}
              placeholder={"Muito ruim\nRuim\nRegular\nBoa\nMuito boa"}
              value={options}
              onChange={(event) => setOptions(event.target.value)}
              required
              disabled={saving}
            />

            <p>Digite uma alternativa em cada linha.</p>
          </>
        )}

        {type === "TEXT" && (
          <p>O estudante poderá escrever uma resposta aberta.</p>
        )}

        <label htmlFor="question-order">Ordem de apresentação</label>

        <input
          id="question-order"
          type="number"
          min={0}
          step={1}
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          required
          disabled={saving}
        />

        <label>
          <input
            type="checkbox"
            checked={required}
            onChange={(event) => setRequired(event.target.checked)}
            disabled={saving}
          />
          Pergunta obrigatória
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "Cadastrando..." : "Adicionar pergunta"}
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
    </section>
  );
}
