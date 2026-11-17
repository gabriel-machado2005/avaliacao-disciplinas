import { BadRequestException } from '@nestjs/common';
import { EntityManager, In, Repository } from 'typeorm';
import { Course } from '../academic/entities/course.entity';
import { Discipline } from '../academic/entities/discipline.entity';
import { Dimension } from '../questionnaires/entities/dimension.entity';
import { QuestionType } from '../questionnaires/entities/question.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { EvaluationAnalysisQueryDto } from './dto/evaluation-analysis-query.dto';
import { Answer } from './entities/answer.entity';
import { EvaluationEligibility } from './entities/evaluation-eligibility.entity';
import { EvaluationPeriod } from './entities/evaluation-period.entity';
import { Evaluation } from './entities/evaluation.entity';
import { Submission } from './entities/submission.entity';

type ScaleTotal = {
  evaluationId: string;
  questionId: string;
  count: string;
  sum: string;
};

type QuestionSeries = {
  questionId: string;
  text: string;
  dimensionId: string;
  dimensionName: string;
  questionnaireName: string;
  scaleMin: number;
  scaleMax: number;
  totals: Map<string, { responses: number; sum: number }>;
};

function isPeriodClosed(period: Pick<EvaluationPeriod, 'endDate'>, now: Date) {
  return now > new Date(period.endDate);
}

export function getResultReleaseError(
  evaluation: Pick<Evaluation, 'evaluationPeriod' | 'minResponsesForResults'>,
  now: Date,
  responseCount?: number,
) {
  if (!isPeriodClosed(evaluation.evaluationPeriod, now)) {
    return 'Os resultados estarão disponíveis somente após o encerramento do período de avaliação.';
  }

  const minimum = evaluation.minResponsesForResults;
  if (minimum === null || minimum < 2) {
    return 'A quantidade mínima de respostas para divulgação dos resultados ainda não foi configurada.';
  }

  if (responseCount !== undefined && responseCount < minimum) {
    return `Os resultados ainda não podem ser divulgados. São necessárias pelo menos ${minimum} respostas.`;
  }
}

async function validateFilters(
  manager: EntityManager,
  query: EvaluationAnalysisQueryDto,
) {
  if (
    query.courseId &&
    !(await manager.existsBy(Course, { id: query.courseId }))
  ) {
    throw new BadRequestException('O curso informado não existe.');
  }

  if (query.disciplineId) {
    const discipline = await manager.findOne(Discipline, {
      where: { id: query.disciplineId },
      relations: { course: true },
    });
    if (!discipline) {
      throw new BadRequestException('A disciplina informada não existe.');
    }
    if (
      query.courseId &&
      discipline.course.id !== query.courseId.toLowerCase()
    ) {
      throw new BadRequestException(
        'A disciplina informada não pertence ao curso selecionado.',
      );
    }
  }

  const professor = query.professorId
    ? await manager.findOne(User, {
        where: { id: query.professorId, role: UserRole.PROFESSOR },
        select: { id: true, name: true },
      })
    : null;
  if (query.professorId && !professor) {
    throw new BadRequestException('O professor informado não existe.');
  }

  const dimension = query.dimensionId
    ? await manager.findOne(Dimension, {
        where: { id: query.dimensionId },
        relations: { questionnaire: true },
      })
    : null;
  if (query.dimensionId && !dimension) {
    throw new BadRequestException('A dimensão informada não existe.');
  }

  return { professor, dimension };
}

async function countByEvaluation<
  Entity extends Submission | EvaluationEligibility,
>(repository: Repository<Entity>, evaluationIds: string[]) {
  if (evaluationIds.length === 0) {
    return new Map<string, number>();
  }

  const totals = await repository
    .createQueryBuilder('item')
    .select('item.evaluation', 'evaluationId')
    .addSelect('COUNT(*)', 'count')
    .where('item.evaluation IN (:...evaluationIds)', { evaluationIds })
    .groupBy('item.evaluation')
    .getRawMany<{ evaluationId: string; count: string }>();

  return new Map(totals.map((row) => [row.evaluationId, Number(row.count)]));
}

async function getScaleTotals(
  manager: EntityManager,
  evaluationIds: string[],
  dimensionId?: string,
) {
  if (evaluationIds.length === 0) {
    return [];
  }

  const totals = manager
    .createQueryBuilder(Answer, 'answer')
    .innerJoin('answer.submission', 'submission')
    .innerJoin('answer.question', 'question')
    .select('submission.evaluation', 'evaluationId')
    .addSelect('question.id', 'questionId')
    .addSelect('COUNT(*)', 'count')
    .addSelect('SUM(answer.scaleValue)', 'sum')
    .where('submission.evaluation IN (:...evaluationIds)', { evaluationIds })
    .andWhere('question.type = :type', { type: QuestionType.SCALE })
    .andWhere(
      'answer.scaleValue BETWEEN question.scaleMin AND question.scaleMax',
    )
    .groupBy('submission.evaluation')
    .addGroupBy('question.id');

  if (dimensionId) {
    totals.andWhere('question.dimension = :dimensionId', { dimensionId });
  }

  return totals.getRawMany<ScaleTotal>();
}

function summarizeQuestions(
  evaluations: Evaluation[],
  scaleTotals: ScaleTotal[],
  periodIds: string[],
) {
  const totalsByQuestion = new Map(
    scaleTotals.map((row) => [`${row.evaluationId}:${row.questionId}`, row]),
  );
  const series = new Map<string, QuestionSeries>();

  for (const evaluation of evaluations) {
    const periodId = evaluation.evaluationPeriod.id;
    for (const dimension of evaluation.questionnaire.dimensions) {
      for (const question of dimension.questions) {
        const row = totalsByQuestion.get(`${evaluation.id}:${question.id}`);
        const { scaleMin, scaleMax } = question;
        if (
          !row ||
          scaleMin === null ||
          scaleMax === null ||
          scaleMax <= scaleMin
        ) {
          continue;
        }

        const responses = Number(row.count);
        // Perguntas opcionais precisam atingir o mínimo em cada avaliação.
        const minimum = evaluation.minResponsesForResults;
        if (minimum === null || responses < minimum) {
          continue;
        }

        const key = `${question.id}:${scaleMin}:${scaleMax}`;
        let questionSeries = series.get(key);
        if (!questionSeries) {
          questionSeries = {
            questionId: question.id,
            text: question.text,
            dimensionId: dimension.id,
            dimensionName: dimension.name,
            questionnaireName: evaluation.questionnaire.name,
            scaleMin,
            scaleMax,
            totals: new Map(),
          };
          series.set(key, questionSeries);
        }

        const total = questionSeries.totals.get(periodId) ?? {
          responses: 0,
          sum: 0,
        };
        total.responses += responses;
        total.sum += Number(row.sum);
        questionSeries.totals.set(periodId, total);
      }
    }
  }

  return Array.from(series.values())
    .filter(({ totals }) => periodIds.every((id) => totals.has(id)))
    .map(({ totals, ...question }) => ({
      ...question,
      periods: periodIds.map((id) => {
        const total = totals.get(id)!;
        return {
          periodId: id,
          responses: total.responses,
          average: total.sum / total.responses,
        };
      }),
    }));
}

export async function queryEvaluationAnalysis(
  manager: EntityManager,
  query: EvaluationAnalysisQueryDto,
  options?: { baselineEvaluationId?: string },
) {
  const now = new Date();
  const periodIds = [query.periodId.toLowerCase()];
  if (query.comparisonPeriodId) {
    const comparisonId = query.comparisonPeriodId.toLowerCase();
    if (periodIds.includes(comparisonId)) {
      throw new BadRequestException(
        'Escolha períodos distintos para comparar.',
      );
    }
    periodIds.push(comparisonId);
  }

  const periodsById = new Map(
    (await manager.findBy(EvaluationPeriod, { id: In(periodIds) })).map(
      (period) => [period.id, period],
    ),
  );
  const periods = periodIds.map((id) => {
    const period = periodsById.get(id);
    if (!period) {
      throw new BadRequestException(
        'Um dos períodos de avaliação informados não existe.',
      );
    }
    return period;
  });
  const requested = await validateFilters(manager, query);

  const closedPeriodIds = periods
    .filter((period) => isPeriodClosed(period, now))
    .map(({ id }) => id);
  const candidates =
    closedPeriodIds.length === 0
      ? []
      : await manager.find(Evaluation, {
          where: {
            evaluationPeriod: { id: In(closedPeriodIds) },
            ...(query.courseId || query.disciplineId
              ? {
                  classGroup: {
                    discipline: {
                      ...(query.disciplineId ? { id: query.disciplineId } : {}),
                      ...(query.courseId
                        ? { course: { id: query.courseId } }
                        : {}),
                    },
                  },
                }
              : {}),
          },
          relations: {
            evaluationPeriod: true,
            classGroup: {
              academicTerm: true,
              professor: true,
              discipline: { course: true },
            },
            questionnaire: { dimensions: { questions: true } },
          },
          order: { createdAt: 'DESC', id: 'ASC' },
        });

  const baselineEvaluationId = options?.baselineEvaluationId;
  const closed = candidates.filter((evaluation) => {
    if (
      baselineEvaluationId &&
      evaluation.evaluationPeriod.id === periodIds[1] &&
      evaluation.id !== baselineEvaluationId
    ) {
      return false;
    }
    return !getResultReleaseError(evaluation, now);
  });
  const responses = await countByEvaluation(
    manager.getRepository(Submission),
    closed.map(({ id }) => id),
  );
  const released = closed.filter(
    (evaluation) =>
      !getResultReleaseError(
        evaluation,
        now,
        responses.get(evaluation.id) ?? 0,
      ),
  );
  const professors = new Map<string, { id: string; name: string }>();
  for (const {
    classGroup: { professor },
  } of released) {
    professors.set(professor.id, { id: professor.id, name: professor.name });
  }
  if (requested.professor) {
    const { id, name } = requested.professor;
    professors.set(id, { id, name });
  }

  const professorId = query.professorId?.toLowerCase();
  const selected = released.filter(
    ({ classGroup }) => !professorId || classGroup.professor.id === professorId,
  );
  const selectedIds = selected.map(({ id }) => id);
  const dimensions = new Map<
    string,
    { id: string; name: string; questionnaireName: string }
  >();
  for (const { questionnaire } of selected) {
    for (const dimension of questionnaire.dimensions) {
      if (dimension.questions.some(({ type }) => type === QuestionType.SCALE)) {
        dimensions.set(dimension.id, {
          id: dimension.id,
          name: dimension.name,
          questionnaireName: questionnaire.name,
        });
      }
    }
  }
  if (requested.dimension) {
    const { id, name, questionnaire } = requested.dimension;
    dimensions.set(id, { id, name, questionnaireName: questionnaire.name });
  }

  const eligible = await countByEvaluation(
    manager.getRepository(EvaluationEligibility),
    selectedIds,
  );
  const scaleTotals = await getScaleTotals(
    manager,
    selectedIds,
    query.dimensionId,
  );

  return {
    periods: periods.map((period) => {
      const evaluations = selected.filter(
        ({ evaluationPeriod }) => evaluationPeriod.id === period.id,
      );
      const eligibleCount = evaluations.reduce(
        (sum, { id }) => sum + (eligible.get(id) ?? 0),
        0,
      );
      const responseCount = evaluations.reduce(
        (sum, { id }) => sum + (responses.get(id) ?? 0),
        0,
      );
      const status =
        evaluations.length > 0
          ? 'AVAILABLE'
          : isPeriodClosed(period, now)
            ? 'NO_RESULTS'
            : 'OPEN';

      return {
        id: period.id,
        name: period.name,
        status,
        participation:
          status === 'AVAILABLE'
            ? {
                eligible: eligibleCount,
                responses: responseCount,
                rate:
                  eligibleCount > 0
                    ? (responseCount / eligibleCount) * 100
                    : null,
              }
            : null,
        evaluations: evaluations.map(({ id, classGroup }) => ({
          id,
          classGroup: classGroup.code,
          discipline: classGroup.discipline.name,
          course: classGroup.discipline.course.name,
          academicTerm: classGroup.academicTerm.code,
          professor: classGroup.professor.name,
        })),
      };
    }),
    filterOptions: {
      professors: Array.from(professors.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
      dimensions: Array.from(dimensions.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
    },
    questions: summarizeQuestions(selected, scaleTotals, periodIds),
  };
}
