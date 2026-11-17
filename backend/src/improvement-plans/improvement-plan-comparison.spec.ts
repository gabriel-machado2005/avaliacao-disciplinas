import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, MoreThan, QueryFailedError } from 'typeorm';
import { EvaluationPeriod } from '../evaluations/entities/evaluation-period.entity';
import { queryEvaluationAnalysis } from '../evaluations/evaluation-analysis';
import { UserRole } from '../users/entities/user.entity';
import { ImprovementPlan } from './entities/improvement-plan.entity';
import { ImprovementPlansService } from './improvement-plans.service';

jest.mock('../evaluations/evaluation-analysis');

describe('Comparação de resultados de planos de melhoria', () => {
  const admin = { userId: 'admin', role: UserRole.ADMIN };
  const coordinator = { userId: 'coord', role: UserRole.COORDINATOR };
  const discipline = { id: 'discipline-a' };
  const origin = {
    id: 'period-origin',
    name: 'Origem',
    endDate: new Date('2025-05-01'),
  };
  const posterior = { id: 'period-follow-up', name: 'Acompanhamento' };
  const originEvaluation = {
    id: 'evaluation-origin',
    evaluationPeriod: origin,
    classGroup: { discipline },
  };
  const plan = {
    id: 'plan-a',
    disciplineId: discipline.id,
    originEvaluation,
    originPeriod: null,
    followUpPeriodId: null as string | null,
  };
  const question = {
    questionId: 'q1',
    text: 'Clareza',
    dimensionId: 'd1',
    dimensionName: 'Conteúdo',
    questionnaireName: 'Questionário',
    scaleMin: 1,
    scaleMax: 5,
    periods: [
      { periodId: posterior.id, responses: 4, average: 5 },
      { periodId: origin.id, responses: 3, average: 3 },
    ],
  };
  const summaries = (
    status: 'AVAILABLE' | 'NO_RESULTS' | 'OPEN' = 'AVAILABLE',
  ) => [
    {
      ...posterior,
      status,
      participation: { eligible: 5, responses: 4, rate: 80 },
      evaluations: [],
    },
    {
      ...origin,
      status: 'AVAILABLE',
      participation: { eligible: 5, responses: 3, rate: 60 },
      evaluations: [],
    },
  ];
  const analysis = jest.mocked(queryEvaluationAnalysis);
  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
  };
  const transaction = jest.fn();
  const service = new ImprovementPlansService({
    transaction,
  } as unknown as DataSource);

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation((_isolation, run) => run(manager));
    manager.findOne.mockResolvedValue({ ...plan });
    manager.find.mockResolvedValue([posterior]);
    analysis.mockResolvedValue({
      periods: summaries(),
      questions: [question],
      filterOptions: { professors: [], dimensions: [] },
    });
  });

  it('compara a disciplina do plano a partir de uma única avaliação de origem e projeta apenas indicadores de perguntas', async () => {
    const result = await service.getComparison(
      plan.id,
      posterior.id.toUpperCase(),
      admin,
    );
    expect(transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function),
    );
    expect(manager.find).toHaveBeenCalledWith(
      EvaluationPeriod,
      expect.objectContaining({
        where: { startDate: MoreThan(origin.endDate) },
      }),
    );
    expect(analysis).toHaveBeenCalledWith(
      manager,
      {
        periodId: posterior.id,
        comparisonPeriodId: origin.id,
        disciplineId: discipline.id,
      },
      { baselineEvaluationId: originEvaluation.id },
    );
    expect(result).toEqual({
      status: 'AVAILABLE',
      message: null,
      savedPeriodId: null,
      periods: [posterior],
      originPeriod: { id: origin.id, name: origin.name },
      followUpPeriod: posterior,
      questions: [question],
    });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('usa a disciplina inteira no período de origem quando nenhuma avaliação específica foi selecionada', async () => {
    manager.findOne.mockResolvedValue({
      ...plan,
      originPeriod: origin,
      originEvaluation: null,
    });
    await service.getComparison(plan.id, posterior.id, coordinator);
    expect(analysis).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ disciplineId: discipline.id }),
      {
        baselineEvaluationId: undefined,
      },
    );
  });

  it.each([undefined, posterior.id])(
    'informa ausência de origem e impõe o vínculo prévio (%s)',
    async (periodId) => {
      manager.findOne.mockResolvedValue({ ...plan, originEvaluation: null });
      await expect(
        service.getComparison(plan.id, periodId, admin),
      ).resolves.toMatchObject({ status: 'NO_ORIGIN', questions: [] });
      await expect(
        service.updateComparison(plan.id, posterior.id, admin),
      ).rejects.toThrow(BadRequestException);
      expect(manager.find).not.toHaveBeenCalled();
      expect(analysis).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    },
  );

  it('impede comparação referenciada por avaliação de outra disciplina', async () => {
    manager.findOne.mockResolvedValue({
      ...plan,
      originEvaluation: {
        ...originEvaluation,
        classGroup: { discipline: { id: 'other' } },
      },
    });
    await expect(
      service.getComparison(plan.id, posterior.id, admin),
    ).resolves.toMatchObject({ status: 'NO_ORIGIN', questions: [] });
    expect(analysis).not.toHaveBeenCalled();
  });

  it.each([origin.id, 'overlap', 'missing'])(
    'rejeita a gravação com período inexistente, igual, anterior ou sobreposto (%s)',
    async (periodId) => {
      await expect(
        service.getComparison(plan.id, periodId, admin),
      ).resolves.toMatchObject({ status: 'INVALID_PERIOD', questions: [] });
      await expect(
        service.updateComparison(plan.id, periodId, admin),
      ).rejects.toThrow(BadRequestException);
      expect(analysis).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['OPEN', 'OPEN'],
    ['NO_RESULTS', 'NO_RESULTS'],
    ['AVAILABLE', 'NO_COMPATIBLE_QUESTIONS'],
  ] as const)(
    'oculta indicadores sem comparação divulgável (%s → %s)',
    async (periodStatus, status) => {
      analysis.mockResolvedValue({
        periods: summaries(periodStatus),
        questions: [],
        filterOptions: { professors: [], dimensions: [] },
      });
      await expect(
        service.getComparison(plan.id, posterior.id, coordinator),
      ).resolves.toMatchObject({ status, questions: [] });
      await expect(
        service.updateComparison(plan.id, posterior.id, coordinator),
      ).rejects.toThrow(BadRequestException);
      expect(manager.update).not.toHaveBeenCalled();
    },
  );

  it('grava somente a referência após revalidar as regras e permite consultá-la por padrão', async () => {
    await expect(
      service.updateComparison(plan.id, posterior.id, admin),
    ).resolves.toMatchObject({
      status: 'AVAILABLE',
      savedPeriodId: posterior.id,
    });
    expect(manager.update).toHaveBeenCalledWith(
      ImprovementPlan,
      { id: plan.id },
      { followUpPeriodId: posterior.id },
    );
    expect(manager.insert).not.toHaveBeenCalled();

    manager.findOne.mockResolvedValue({
      ...plan,
      followUpPeriodId: posterior.id,
    });
    await expect(
      service.getComparison(plan.id, undefined, admin),
    ).resolves.toMatchObject({
      status: 'AVAILABLE',
      savedPeriodId: posterior.id,
      followUpPeriod: posterior,
    });
    expect(analysis).toHaveBeenCalledTimes(2);
  });

  it('preserva a referência gravada quando a comparação deixa de ser divulgável', async () => {
    manager.findOne.mockResolvedValue({
      ...plan,
      followUpPeriodId: posterior.id,
    });
    analysis.mockResolvedValue({
      periods: summaries('NO_RESULTS'),
      questions: [],
      filterOptions: { professors: [], dimensions: [] },
    });
    await expect(
      service.getComparison(plan.id, undefined, coordinator),
    ).resolves.toMatchObject({
      status: 'NO_RESULTS',
      savedPeriodId: posterior.id,
      questions: [],
    });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('remove somente o vínculo e mantém o plano e o histórico', async () => {
    manager.findOne.mockResolvedValue({
      ...plan,
      followUpPeriodId: posterior.id,
    });
    await expect(
      service.updateComparison(plan.id, null, admin),
    ).resolves.toMatchObject({
      status: 'SELECT_PERIOD',
      savedPeriodId: null,
      questions: [],
    });
    expect(manager.update).toHaveBeenCalledWith(
      ImprovementPlan,
      { id: plan.id },
      { followUpPeriodId: null },
    );
    expect(manager.insert).not.toHaveBeenCalled();
    expect(analysis).not.toHaveBeenCalled();
  });

  it('retorna conflito em caso de edição concorrente do plano', async () => {
    manager.update.mockRejectedValue(
      new QueryFailedError(
        'UPDATE',
        [],
        Object.assign(new Error('serialization'), { code: '40001' }),
      ),
    );
    await expect(
      service.updateComparison(plan.id, posterior.id, coordinator),
    ).rejects.toThrow(ConflictException);
  });

  it.each([UserRole.PROFESSOR, UserRole.STUDENT])(
    'bloqueia consulta e gravação pelo perfil %s',
    async (role) => {
      const requester = { userId: 'assignee', role };
      expect(() =>
        service.getComparison(plan.id, posterior.id, requester),
      ).toThrow(ForbiddenException);
      await expect(
        service.updateComparison(plan.id, null, requester),
      ).rejects.toThrow(ForbiddenException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('retorna 404 para plano inexistente', async () => {
    manager.findOne.mockResolvedValue(null);
    await expect(
      service.getComparison(plan.id, undefined, coordinator),
    ).rejects.toThrow(NotFoundException);
    expect(manager.find).not.toHaveBeenCalled();
  });
});
