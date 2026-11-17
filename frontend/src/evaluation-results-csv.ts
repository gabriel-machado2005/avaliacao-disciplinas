type QuestionMetadata = {
  id: string;
  text: string;
};

type ResultQuestion = QuestionMetadata &
  (
    | {
        status: "PROTECTED" | "NO_RESPONSES";
        type: "SCALE" | "SINGLE_CHOICE" | "TEXT";
      }
    | {
        status: "AVAILABLE";
        type: "SCALE";
        responses: number;
        average: number;
        distribution: Record<string, number>;
      }
    | {
        status: "AVAILABLE";
        type: "SINGLE_CHOICE";
        responses: number;
        distribution: Record<string, number>;
      }
    | {
        status: "COMMENTS_PROTECTED";
        type: "TEXT";
        responses: number;
      }
  );

export type EvaluationResult = {
  evaluation: {
    discipline: {
      name: string;
      code: string;
    };
    classGroup: string;
    academicTerm: string;
  };
  participation: {
    eligible: number;
    responses: number;
    rate: number;
  };
  dimensions: {
    id: string;
    name: string;
    questions: ResultQuestion[];
  }[];
};

export const questionStatusLabels: Record<ResultQuestion["status"], string> = {
  AVAILABLE: "Divulgado",
  PROTECTED: "Resultados protegidos",
  NO_RESPONSES: "Sem respostas",
  COMMENTS_PROTECTED: "Comentários protegidos",
};

function formatCell(value: string | number) {
  let text = String(value);

  // Evita que textos sejam interpretados como fórmulas no Excel.
  if (/^\s*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return '"' + text.replace(/"/g, '""') + '"';
}

export function buildEvaluationResultsCsv(results: EvaluationResult) {
  const headers = [
    "Disciplina",
    "Código",
    "Turma",
    "Semestre",
    "Estudantes habilitados",
    "Respostas recebidas",
    "Taxa de participação (%)",
    "Dimensão",
    "Pergunta",
    "Tipo",
    "Respostas da pergunta",
    "Média",
    "Distribuição",
    "Situação da divulgação",
  ];
  const rows: (string | number)[][] = [headers];

  for (const dimension of results.dimensions) {
    for (const question of dimension.questions) {
      let responses: string | number = "";
      let average = "";
      let distribution = "";

      if (question.status === "AVAILABLE") {
        responses = question.responses;
        if (question.type === "SCALE") {
          average = question.average.toLocaleString("pt-BR");
        }
        distribution = Object.entries(question.distribution)
          .map(([option, count]) => option + ": " + count)
          .join(" | ");
      } else if (question.status === "COMMENTS_PROTECTED") {
        responses = question.responses;
      }

      rows.push([
        results.evaluation.discipline.name,
        results.evaluation.discipline.code,
        results.evaluation.classGroup,
        results.evaluation.academicTerm,
        results.participation.eligible,
        results.participation.responses,
        results.participation.rate.toLocaleString("pt-BR"),
        dimension.name,
        question.text,
        question.type,
        responses,
        average,
        distribution,
        questionStatusLabels[question.status],
      ]);
    }
  }

  return (
    "\uFEFF" + rows.map((row) => row.map(formatCell).join(";")).join("\r\n")
  );
}
