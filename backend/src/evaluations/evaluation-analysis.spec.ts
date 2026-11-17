import type { EntityManager } from 'typeorm';
import { Course } from '../academic/entities/course.entity';
import { Discipline } from '../academic/entities/discipline.entity';
import { Dimension } from '../questionnaires/entities/dimension.entity';
import { QuestionType } from '../questionnaires/entities/question.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Answer } from './entities/answer.entity';
import { EvaluationEligibility } from './entities/evaluation-eligibility.entity';
import { Evaluation } from './entities/evaluation.entity';
import { Submission } from './entities/submission.entity';
import {
  getResultReleaseError,
  queryEvaluationAnalysis,
} from './evaluation-analysis';

describe('Análise de resultados', () => {
  const course = { id: 'course-a', name: 'Computação' };
  const professor = {
    id: 'professor-a',
    name: 'Docente A',
    email: 'email-restrito',
    active: false,
  };
  const discipline = { id: 'discipline-a', name: 'Programação', course };
  const current = {
    id: 'period-a',
    name: 'Período atual',
    endDate: new Date('2024-12-01'),
    active: false,
  };
  const previous = {
    id: 'period-b',
    name: 'Período anterior',
    endDate: new Date('2023-12-01'),
    active: true,
  };
  const open = {
    id: 'period-c',
    name: 'Período em andamento',
    endDate: new Date('2099-12-01'),
    active: false,
  };
  const scale = {
    id: 'scale-a',
    text: 'Clareza do conteúdo',
    type: QuestionType.SCALE,
    scaleMin: 1,
    scaleMax: 5,
  };
  const optionalScale = { ...scale, id: 'optional-scale' };
  const freeText = {
    id: 'text-a',
    type: QuestionType.TEXT,
    scaleMin: null,
    scaleMax: null,
  };
  const dimension = {
    id: 'dimension-a',
    name: 'Conteúdo',
    questions: [scale, optionalScale, freeText],
  };
  const questionnaire = {
    id: 'questionnaire-a',
    name: 'Questionário docente',
    dimensions: [dimension],
  };
  const classGroup = {
    code: 'A01',
    professor,
    discipline,
    academicTerm: { code: '2024/2' },
  };

  function createEvaluation(
    id: string,
    evaluationPeriod = current,
    minResponsesForResults: number | null = 3,
  ) {
    return {
      id,
      evaluationPeriod,
      minResponsesForResults,
      classGroup,
      questionnaire,
    };
  }

  function queryBuilder() {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
  }

  const manager = {
    find: jest.fn(),
    findBy: jest.fn(),
    findOne: jest.fn(),
    existsBy: jest.fn(),
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  let submissions: ReturnType<typeof queryBuilder>;
  let eligibilities: ReturnType<typeof queryBuilder>;
  let answers: ReturnType<typeof queryBuilder>;

  beforeEach(() => {
    jest.resetAllMocks();
    submissions = queryBuilder();
    eligibilities = queryBuilder();
    answers = queryBuilder();
    manager.findBy.mockResolvedValue([previous, open, current]);
    manager.find.mockResolvedValue([]);
    manager.existsBy.mockImplementation(
      async (entity, where) => entity === Course && where.id === course.id,
    );
    manager.findOne.mockImplementation(async (entity, { where }) => {
      if (entity === Discipline && where.id === discipline.id) {
        return discipline;
      }
      if (
        entity === User &&
        where.id === professor.id &&
        where.role === UserRole.PROFESSOR
      ) {
        return { id: professor.id, name: professor.name };
      }
      if (entity === Dimension && where.id === dimension.id) {
        return { ...dimension, questionnaire };
      }
      return null;
    });
    manager.getRepository.mockImplementation((entity) => {
      if (entity === Submission) {
        return { createQueryBuilder: () => submissions };
      }
      if (entity === EvaluationEligibility) {
        return { createQueryBuilder: () => eligibilities };
      }
      throw new Error('Repositório inesperado');
    });
    manager.createQueryBuilder.mockImplementation((entity) => {
      expect(entity).toBe(Answer);
      return answers;
    });
  });

  function analyze(query: Parameters<typeof queryEvaluationAnalysis>[1]) {
    return queryEvaluationAnalysis(manager as unknown as EntityManager, query);
  }

  it('deve rejeitar a comparação de um período com ele mesmo, incluindo UUIDs em maiúsculas', async () => {
    await expect(
      analyze({ periodId: 'period-a', comparisonPeriodId: 'PERIOD-A' }),
    ).rejects.toThrow('Escolha períodos distintos');
    expect(manager.findBy).not.toHaveBeenCalled();
  });

  it.each([
    [{ periodId: 'inexistente' }, 'períodos de avaliação'],
    [
      { periodId: 'period-a', comparisonPeriodId: 'inexistente' },
      'períodos de avaliação',
    ],
    [
      { periodId: 'period-a', courseId: 'inexistente' },
      'curso informado não existe',
    ],
    [
      { periodId: 'period-a', disciplineId: 'inexistente' },
      'disciplina informada não existe',
    ],
    [
      { periodId: 'period-a', professorId: 'inexistente' },
      'professor informado não existe',
    ],
    [
      { periodId: 'period-a', dimensionId: 'inexistente' },
      'dimensão informada não existe',
    ],
  ] as const)(
    'deve rejeitar filtros inexistentes (%j)',
    async (query, message) => {
      await expect(analyze(query)).rejects.toThrow(message);
      expect(manager.find).not.toHaveBeenCalled();
    },
  );

  it('deve rejeitar uma disciplina vinculada a outro curso', async () => {
    manager.existsBy.mockResolvedValue(true);
    await expect(
      analyze({
        periodId: current.id,
        courseId: 'course-b',
        disciplineId: discipline.id,
      }),
    ).rejects.toThrow('não pertence ao curso selecionado');
    expect(manager.find).not.toHaveBeenCalled();
  });

  it('deve manter os filtros selecionados quando o recorte é válido e está vazio', async () => {
    const result = await analyze({
      periodId: current.id,
      professorId: professor.id,
      dimensionId: dimension.id,
    });
    expect(result.periods[0]).toMatchObject({
      status: 'NO_RESULTS',
      participation: null,
      evaluations: [],
    });
    expect(result.filterOptions).toEqual({
      professors: [{ id: professor.id, name: professor.name }],
      dimensions: [
        {
          id: dimension.id,
          name: dimension.name,
          questionnaireName: questionnaire.name,
        },
      ],
    });
  });

  it('deve bloquear a divulgação no instante exato do encerramento', () => {
    expect(
      getResultReleaseError(
        createEvaluation('evaluation-a') as unknown as Evaluation,
        current.endDate,
        3,
      ),
    ).toContain('após o encerramento');
  });

  it('restringe a base à avaliação indicada antes de contar respostas, preservando o período posterior', async () => {
    manager.find.mockResolvedValue([
      createEvaluation('base', previous),
      createEvaluation('outra-da-base', previous),
      createEvaluation('posterior', current),
    ]);
    submissions.getRawMany.mockResolvedValue([
      { evaluationId: 'base', count: '3' },
      { evaluationId: 'posterior', count: '3' },
    ]);

    const result = await queryEvaluationAnalysis(
      manager as unknown as EntityManager,
      {
        periodId: current.id,
        comparisonPeriodId: previous.id,
        disciplineId: discipline.id,
      },
      { baselineEvaluationId: 'base' },
    );

    for (const builder of [submissions, eligibilities, answers]) {
      expect(builder.where).toHaveBeenCalledWith(expect.any(String), {
        evaluationIds: ['base', 'posterior'],
      });
    }
    expect(
      result.periods.map(({ evaluations }) => evaluations.map(({ id }) => id)),
    ).toEqual([['posterior'], ['base']]);
  });

  it('deve excluir avaliações abertas, abaixo do mínimo ou sem mínimo de métricas, totais e detalhes', async () => {
    manager.find.mockResolvedValue([
      createEvaluation('available'),
      createEvaluation('low'),
      createEvaluation('unset', current, null),
      createEvaluation('invalid-minimum', current, 1),
      createEvaluation('open', open),
    ]);
    submissions.getRawMany.mockResolvedValue([
      { evaluationId: 'available', count: '3' },
      { evaluationId: 'low', count: '2' },
    ]);
    eligibilities.getRawMany.mockResolvedValue([
      { evaluationId: 'available', count: '5' },
    ]);
    answers.getRawMany.mockResolvedValue([
      {
        evaluationId: 'available',
        questionId: scale.id,
        count: '3',
        sum: '12',
      },
      {
        evaluationId: 'available',
        questionId: optionalScale.id,
        count: '2',
        sum: '7',
      },
    ]);

    const result = await analyze({
      periodId: current.id,
      comparisonPeriodId: open.id,
    });

    expect(submissions.where).toHaveBeenCalledWith(expect.any(String), {
      evaluationIds: ['available', 'low'],
    });
    for (const builder of [eligibilities, answers]) {
      expect(builder.where).toHaveBeenCalledWith(expect.any(String), {
        evaluationIds: ['available'],
      });
    }
    expect(answers.andWhere).toHaveBeenCalledWith('question.type = :type', {
      type: QuestionType.SCALE,
    });
    expect(result.periods).toEqual([
      expect.objectContaining({
        status: 'AVAILABLE',
        participation: { eligible: 5, responses: 3, rate: 60 },
        evaluations: [expect.objectContaining({ id: 'available' })],
      }),
      {
        id: open.id,
        name: open.name,
        status: 'OPEN',
        participation: null,
        evaluations: [],
      },
    ]);
    expect(result.questions).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(
      /email-restrito|optional-scale|studentId|submissionId|textValue|comments/,
    );
  });

  it('deve consultar os filtros e calcular médias ponderadas só para perguntas compatíveis e divulgáveis nos dois períodos', async () => {
    const differentId = { ...scale, id: 'scale-b' };
    const differentScale = { ...scale, id: 'scale-c', scaleMax: 7 };
    const withQuestions = (
      evaluation: ReturnType<typeof createEvaluation>,
      questions: (typeof scale)[],
    ) => ({
      ...evaluation,
      questionnaire: {
        ...questionnaire,
        dimensions: [{ ...dimension, questions }],
      },
    });
    const evaluations = [
      withQuestions(createEvaluation('current-a'), [
        scale,
        optionalScale,
        differentScale,
      ]),
      withQuestions(createEvaluation('current-b'), [scale, optionalScale]),
      withQuestions(createEvaluation('previous-a', previous), [
        scale,
        optionalScale,
        differentId,
        { ...differentScale, scaleMax: 5 },
      ]),
      {
        ...createEvaluation('other-professor'),
        classGroup: {
          ...classGroup,
          professor: { id: 'professor-b', name: 'Docente B' },
        },
      },
    ];
    manager.find.mockResolvedValue(evaluations);
    submissions.getRawMany.mockResolvedValue([
      { evaluationId: 'current-a', count: '3' },
      { evaluationId: 'current-b', count: '6' },
      { evaluationId: 'previous-a', count: '3' },
      { evaluationId: 'other-professor', count: '3' },
    ]);
    eligibilities.getRawMany.mockResolvedValue([
      { evaluationId: 'current-a', count: '5' },
      { evaluationId: 'current-b', count: '10' },
      { evaluationId: 'previous-a', count: '4' },
    ]);
    answers.getRawMany.mockResolvedValue([
      {
        evaluationId: 'current-a',
        questionId: scale.id,
        count: '3',
        sum: '15',
      },
      {
        evaluationId: 'current-b',
        questionId: scale.id,
        count: '6',
        sum: '12',
      },
      {
        evaluationId: 'previous-a',
        questionId: scale.id,
        count: '3',
        sum: '9',
      },
      {
        evaluationId: 'current-a',
        questionId: optionalScale.id,
        count: '2',
        sum: '8',
      },
      {
        evaluationId: 'current-b',
        questionId: optionalScale.id,
        count: '2',
        sum: '6',
      },
      {
        evaluationId: 'previous-a',
        questionId: optionalScale.id,
        count: '3',
        sum: '12',
      },
      {
        evaluationId: 'previous-a',
        questionId: differentId.id,
        count: '3',
        sum: '9',
      },
      {
        evaluationId: 'current-a',
        questionId: differentScale.id,
        count: '3',
        sum: '18',
      },
      {
        evaluationId: 'previous-a',
        questionId: differentScale.id,
        count: '3',
        sum: '9',
      },
    ]);

    const result = await analyze({
      periodId: current.id,
      comparisonPeriodId: previous.id,
      courseId: course.id,
      disciplineId: discipline.id,
      professorId: professor.id,
      dimensionId: dimension.id,
    });

    expect(manager.find).toHaveBeenCalledWith(
      Evaluation,
      expect.objectContaining({
        where: expect.objectContaining({
          classGroup: {
            discipline: { id: discipline.id, course: { id: course.id } },
          },
        }),
      }),
    );
    expect(answers.where).toHaveBeenCalledWith(expect.any(String), {
      evaluationIds: ['current-a', 'current-b', 'previous-a'],
    });
    expect(answers.andWhere).toHaveBeenCalledWith(
      'question.dimension = :dimensionId',
      { dimensionId: dimension.id },
    );
    expect(result.periods.map(({ participation }) => participation)).toEqual([
      { eligible: 15, responses: 9, rate: 60 },
      { eligible: 4, responses: 3, rate: 75 },
    ]);
    expect(result.questions).toEqual([
      {
        questionId: scale.id,
        text: scale.text,
        dimensionId: dimension.id,
        dimensionName: dimension.name,
        questionnaireName: questionnaire.name,
        scaleMin: 1,
        scaleMax: 5,
        periods: [
          { periodId: current.id, responses: 9, average: 3 },
          { periodId: previous.id, responses: 3, average: 3 },
        ],
      },
    ]);
  });
});
