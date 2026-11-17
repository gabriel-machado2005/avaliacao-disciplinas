import { EntityManager, MoreThan } from 'typeorm';
import { EvaluationPeriod } from '../evaluations/entities/evaluation-period.entity';
import { queryEvaluationAnalysis } from '../evaluations/evaluation-analysis';
import { ImprovementPlan } from './entities/improvement-plan.entity';

export const comparisonRelations = {
  originPeriod: true,
  originEvaluation: {
    evaluationPeriod: true,
    classGroup: { discipline: true },
  },
} as const;

export async function compareImprovementPlan(
  manager: EntityManager,
  plan: ImprovementPlan,
  periodId = plan.followUpPeriodId,
) {
  const originEvaluation = plan.originEvaluation;
  const origin = originEvaluation?.evaluationPeriod ?? plan.originPeriod;
  const context = {
    originPeriod: origin ? { id: origin.id, name: origin.name } : null,
    savedPeriodId: plan.followUpPeriodId,
    periods: [] as { id: string; name: string }[],
  };

  const unavailable = (
    status:
      | 'NO_ORIGIN'
      | 'SELECT_PERIOD'
      | 'INVALID_PERIOD'
      | 'OPEN'
      | 'NO_RESULTS'
      | 'NO_COMPATIBLE_QUESTIONS',
    message: string,
    followUpPeriod: { id: string; name: string } | null = null,
  ) => ({ ...context, status, message, followUpPeriod, questions: [] });

  if (
    !origin ||
    (originEvaluation &&
      originEvaluation.classGroup.discipline.id !== plan.disciplineId)
  ) {
    return unavailable(
      'NO_ORIGIN',
      'Defina uma origem para o plano, vinculando um período ou uma avaliação da disciplina, para comparar os resultados.',
    );
  }

  context.periods = await manager.find(EvaluationPeriod, {
    where: { startDate: MoreThan(origin.endDate) },
    select: { id: true, name: true },
    order: { startDate: 'DESC', id: 'ASC' },
  });

  if (!periodId) {
    return unavailable(
      'SELECT_PERIOD',
      context.periods.length
        ? 'Selecione um período posterior para consultar os resultados.'
        : 'Nenhum período de avaliação começa após o encerramento da origem.',
    );
  }

  const followUpPeriod = context.periods.find(
    ({ id }) => id === periodId.toLowerCase(),
  );
  if (!followUpPeriod) {
    return unavailable(
      'INVALID_PERIOD',
      'Selecione um período de avaliação que comece após o encerramento da origem.',
    );
  }

  const analysis = await queryEvaluationAnalysis(
    manager,
    {
      periodId: followUpPeriod.id,
      comparisonPeriodId: origin.id,
      disciplineId: plan.disciplineId,
    },
    { baselineEvaluationId: originEvaluation?.id },
  );

  if (analysis.periods.some(({ status }) => status === 'OPEN')) {
    return unavailable(
      'OPEN',
      'A comparação fica disponível após o encerramento dos dois períodos.',
      followUpPeriod,
    );
  }
  if (analysis.periods.some(({ status }) => status === 'NO_RESULTS')) {
    return unavailable(
      'NO_RESULTS',
      'Um dos períodos ainda não tem resultados divulgáveis para a referência e a disciplina deste plano.',
      followUpPeriod,
    );
  }
  if (!analysis.questions.length) {
    return unavailable(
      'NO_COMPATIBLE_QUESTIONS',
      'Não há perguntas de escala compatíveis com respostas suficientes nos dois períodos.',
      followUpPeriod,
    );
  }

  return {
    ...context,
    status: 'AVAILABLE' as const,
    message: null,
    followUpPeriod,
    questions: analysis.questions,
  };
}
