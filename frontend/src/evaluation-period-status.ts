type EvaluationPeriod = {
  active: boolean;
  startDate: string;
  endDate: string;
};

export function getEvaluationPeriodStatus(
  period: EvaluationPeriod,
  referenceTime: number,
) {
  if (!period.active) {
    return { label: "Inativa", style: "inactive" };
  }

  if (referenceTime < new Date(period.startDate).getTime()) {
    return { label: "Ainda não iniciada", style: "pending" };
  }

  if (referenceTime > new Date(period.endDate).getTime()) {
    return { label: "Encerrada", style: "inactive" };
  }

  return { label: "Em andamento", style: "active" };
}
