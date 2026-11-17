export type QuestionResult = {
  questionId: string;
  text: string;
  dimensionId: string;
  dimensionName: string;
  questionnaireName: string;
  scaleMin: number;
  scaleMax: number;
  periods: { periodId: string; responses: number; average: number }[];
};

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});
const differenceFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export function MetricBar({ width }: { width: number }) {
  return (
    <div className="results-distribution__track" aria-hidden="true">
      <div
        className="results-distribution__fill"
        style={{ width: `${Math.min(100, Math.max(0, width))}%` }}
      />
    </div>
  );
}

export default function EvaluationQuestionMetrics({
  question,
  periods,
  showDimension = false,
}: {
  question: QuestionResult;
  periods: { id: string; name: string }[];
  showDimension?: boolean;
}) {
  return (
    <article className="evaluation-card ui-card">
      <h5 className="ui-card__title">{question.text}</h5>
      <p className="ui-card__meta">
        {showDimension && `${question.dimensionName} · `}
        Escala de {question.scaleMin} a {question.scaleMax}
      </p>
      <ul className="evaluation-analysis__metrics">
        {question.periods.map((metric) => (
          <li key={metric.periodId}>
            <p>
              {periods.find(({ id }) => id === metric.periodId)?.name} · Média{" "}
              <b>{numberFormat.format(metric.average)}</b> (
              {numberFormat.format(metric.responses)} respostas)
            </p>
            <MetricBar
              width={
                ((metric.average - question.scaleMin) /
                  (question.scaleMax - question.scaleMin)) *
                100
              }
            />
          </li>
        ))}
      </ul>
      {question.periods.length === 2 && (
        <p className="ui-card__meta">
          Variação de{" "}
          {differenceFormat.format(
            question.periods[0].average - question.periods[1].average,
          )}{" "}
          pontos na escala
        </p>
      )}
    </article>
  );
}
