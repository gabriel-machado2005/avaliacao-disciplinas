import { useState } from "react";

type Question = {
  id: string;
  text: string;
  type: "SCALE" | "SINGLE_CHOICE" | "TEXT";
  required: boolean;
  scaleMin: number | null;
  scaleMax: number | null;
  options: string[] | null;
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

  function updateAnswer(questionId: string, value: string) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  }

  return (
    <div>
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

      <button type="button" onClick={onBack}>
        Voltar às avaliações
      </button>
    </div>
  );
}
