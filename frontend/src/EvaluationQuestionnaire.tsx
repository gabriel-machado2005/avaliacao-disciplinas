import { useState } from "react";
import type { FormEvent } from "react";

type Question = {
  id: string;
  text: string;
  type: "SCALE" | "SINGLE_CHOICE" | "TEXT";
  required: boolean;
  scaleMin: number | null;
  scaleMax: number | null;
  options: string[] | null;
};
type SubmissionAnswer = {
  questionId: string;
  scaleValue?: number;
  choiceValue?: string;
  textValue?: string;
};

export type QuestionnaireResponse = {
  evaluationId: string;
  questionnaire: {
    name: string;
    dimensions: {
      id: string;
      name: string;
      questions: Question[];
    }[];
  };
};

type Props = {
  data: QuestionnaireResponse;
  onBack: () => void;
};

export default function EvaluationQuestionnaire({ data, onBack }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function updateAnswer(questionId: string, value: string) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || submitted) {
      return;
    }

    setError("");

    const questions = data.questionnaire.dimensions.flatMap(
      (dimension) => dimension.questions,
    );

    const submissionAnswers = questions.flatMap(
      (question): SubmissionAnswer[] => {
        const value = answers[question.id]?.trim() ?? "";

        if (!value) {
          return [];
        }

        if (question.type === "SCALE") {
          return [{ questionId: question.id, scaleValue: Number(value) }];
        }

        if (question.type === "SINGLE_CHOICE") {
          return [{ questionId: question.id, choiceValue: value }];
        }

        return [{ questionId: question.id, textValue: value }];
      },
    );

    setSubmitting(true);

    try {
      const token = sessionStorage.getItem("accessToken");

      if (!token) {
        throw new Error("Sua sessão terminou. Faça login novamente.");
      }

      const response = await fetch(
        `http://localhost:3000/evaluations/${data.evaluationId}/submissions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            answers: submissionAnswers,
          }),
        },
      );

      if (!response.ok) {
        const errorData: { message?: string | string[] } = await response
          .json()
          .catch(() => ({}));

        const errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(" ")
          : errorData.message;

        throw new Error(
          errorMessage || `Não foi possível enviar (${response.status}).`,
        );
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao enviar avaliação.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div>
        <h2>Avaliação enviada!</h2>
        <p>Suas respostas foram registradas com sucesso.</p>

        <button type="button" onClick={onBack}>
          Voltar às avaliações
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{data.questionnaire.name}</h2>

      {data.questionnaire.dimensions.map((dimension) => (
        <section key={dimension.id}>
          <h3>{dimension.name}</h3>

          {dimension.questions.map((question) => (
            <div key={question.id} className="form-group">
              <label htmlFor={question.id}>
                {question.text}
                {question.required && " *"}
              </label>

              {question.type === "SCALE" && (
                <select
                  id={question.id}
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    updateAnswer(question.id, event.target.value)
                  }
                  required={question.required}
                >
                  <option value="">Selecione uma nota</option>

                  {Array.from(
                    {
                      length: Math.max(
                        0,
                        (question.scaleMax ?? 0) - (question.scaleMin ?? 0) + 1,
                      ),
                    },
                    (_, index) => (question.scaleMin ?? 0) + index,
                  ).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              )}

              {question.type === "SINGLE_CHOICE" && (
                <select
                  id={question.id}
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    updateAnswer(question.id, event.target.value)
                  }
                  required={question.required}
                >
                  <option value="">Selecione uma opção</option>

                  {question.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}

              {question.type === "TEXT" && (
                <textarea
                  id={question.id}
                  rows={4}
                  placeholder="Digite seu comentário (opcional)"
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    updateAnswer(question.id, event.target.value)
                  }
                  required={question.required}
                />
              )}
            </div>
          ))}
        </section>
      ))}

      {error && (
        <p role="alert" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando..." : "Enviar avaliação"}
      </button>

      <button type="button" onClick={onBack} disabled={submitting}>
        Voltar às avaliações
      </button>
    </form>
  );
}
