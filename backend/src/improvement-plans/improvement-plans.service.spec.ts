import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { Discipline } from '../academic/entities/discipline.entity';
import { EvaluationPeriod } from '../evaluations/entities/evaluation-period.entity';
import { Evaluation } from '../evaluations/entities/evaluation.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ImprovementPlanStatusHistory } from './entities/improvement-plan-status-history.entity';
import {
  ImprovementPlan,
  ImprovementPlanStatus as Status,
} from './entities/improvement-plan.entity';
import { ImprovementPlansService } from './improvement-plans.service';

describe('ImprovementPlansService', () => {
  const coordinator = { userId: 'coord-a', role: UserRole.COORDINATOR };
  const professor = { userId: 'prof-a', role: UserRole.PROFESSOR };
  const student = { userId: 'student-a', role: UserRole.STUDENT };
  const dto = {
    disciplineId: 'discipline-a',
    assigneeId: professor.userId,
    problem: 'Exercícios insuficientes.',
    action: 'Elaborar novas listas.',
    dueDate: '2027-02-15',
  };
  const period = { id: 'period-a', name: '2026/2' };
  const originEvaluation = {
    id: 'eval-a',
    evaluationPeriod: period,
    classGroup: { code: 'A01' },
    answers: ['DADO PRIVADO'],
  };
  const fixture = () => ({
    ...dto,
    id: 'plan-a',
    status: Status.PENDING,
    discipline: { id: dto.disciplineId, code: 'PROG', name: 'Programação' },
    assignee: {
      id: professor.userId,
      role: professor.role,
      name: 'Docente A',
      email: 'EMAIL PRIVADO',
    },
    originPeriodId: null,
    originEvaluationId: originEvaluation.id,
    followUpPeriodId: null as string | null,
    originPeriod: null,
    originEvaluation,
    createdAt: new Date('2026-11-01'),
    updatedAt: new Date('2026-11-01'),
  });
  let plan: ReturnType<typeof fixture>;
  const manager = {
    find: jest.fn(),
    findOne: jest.fn(),
    existsBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
  };
  const transaction = jest.fn();
  const service = new ImprovementPlansService({
    manager,
    transaction,
  } as unknown as DataSource);

  beforeEach(() => {
    jest.resetAllMocks();
    plan = fixture();
    transaction.mockImplementation((...args) => args.at(-1)(manager));
    manager.findOne.mockImplementation(async (entity, { where }) => {
      if (entity === Evaluation) return { id: originEvaluation.id };
      if (where.assigneeId && where.assigneeId !== plan.assigneeId) return null;
      return plan;
    });
    manager.existsBy.mockResolvedValue(true);
    manager.save.mockImplementation(async (_entity, values) => ({
      ...plan,
      ...values,
    }));
    manager.find.mockImplementation(async (entity) => {
      if (entity === ImprovementPlanStatusHistory) {
        return [
          {
            id: 1,
            previousStatus: null,
            status: Status.PENDING,
            changedAt: plan.createdAt,
            author: { name: 'Coordenação A', email: 'EMAIL PRIVADO' },
          },
        ];
      }
      return [plan];
    });
  });

  it('registra a situação inicial e o autor na mesma transação do cadastro', async () => {
    const result = await service.create(
      { ...dto, originEvaluationId: originEvaluation.id },
      coordinator,
    );
    expect(manager.save).toHaveBeenCalledWith(ImprovementPlan, {
      ...dto,
      originPeriodId: null,
      originEvaluationId: originEvaluation.id,
      status: Status.PENDING,
    });
    expect(manager.insert).toHaveBeenCalledWith(ImprovementPlanStatusHistory, {
      planId: plan.id,
      previousStatus: null,
      status: Status.PENDING,
      authorId: coordinator.userId,
      changedAt: expect.any(Date),
    });
    expect(manager.findOne).toHaveBeenCalledWith(
      Evaluation,
      expect.objectContaining({
        lock: { mode: 'pessimistic_read' },
      }),
    );
    expect(manager.existsBy).toHaveBeenCalledWith(Evaluation, {
      id: originEvaluation.id,
      classGroup: { discipline: { id: dto.disciplineId } },
    });
    expect(result.originPeriod).toEqual(period);
    expect(result.originEvaluation).toEqual({
      id: originEvaluation.id,
      classCode: 'A01',
    });
    expect(JSON.stringify(result)).not.toMatch(/DADO PRIVADO|EMAIL PRIVADO/);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('aceita cadastro sem origem e com prazo histórico', async () => {
    const dueDate = '2024-02-29';
    await service.create({ ...dto, dueDate }, coordinator);
    expect(manager.save).toHaveBeenCalledWith(
      ImprovementPlan,
      expect.objectContaining({
        dueDate,
        originPeriodId: null,
        originEvaluationId: null,
      }),
    );
    expect(manager.findOne).not.toHaveBeenCalledWith(
      Evaluation,
      expect.anything(),
    );
  });

  it.each([
    [Discipline, 'A disciplina informada não existe.'],
    [User, 'Selecione um responsável ativo'],
    [EvaluationPeriod, 'O período de origem informado não existe.'],
  ])(
    'rejeita vínculo inexistente ou inelegível (%p)',
    async (entity, message) => {
      manager.existsBy.mockImplementation(
        async (candidate) => candidate !== entity,
      );
      await expect(
        service.create({ ...dto, originPeriodId: period.id }, coordinator),
      ).rejects.toThrow(message);
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    },
  );

  it('rejeita uma avaliação de origem de outra disciplina', async () => {
    manager.existsBy.mockImplementation(
      async (entity) => entity !== Evaluation,
    );
    await expect(
      service.create(
        { ...dto, originEvaluationId: originEvaluation.id },
        coordinator,
      ),
    ).rejects.toThrow(
      'A avaliação de origem deve pertencer à disciplina do plano.',
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejeita uma avaliação de origem inexistente', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    await expect(
      service.create({ ...dto, originEvaluationId: 'missing' }, coordinator),
    ).rejects.toThrow('A avaliação de origem informada não existe.');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejeita período e avaliação como origem simultânea', async () => {
    await expect(
      service.create(
        {
          ...dto,
          originPeriodId: period.id,
          originEvaluationId: originEvaluation.id,
        },
        coordinator,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('troca a origem de avaliação para período com remoção explícita, preservando o histórico', async () => {
    plan.followUpPeriodId = 'period-follow-up';
    await service.update(
      plan.id,
      {
        originPeriodId: period.id,
        originEvaluationId: null,
        action: 'Ação ajustada.',
      },
      coordinator,
    );
    expect(manager.save).toHaveBeenCalledWith(
      ImprovementPlan,
      expect.objectContaining({
        disciplineId: dto.disciplineId,
        action: 'Ação ajustada.',
        originPeriodId: period.id,
        originEvaluationId: null,
        followUpPeriodId: null,
        status: Status.PENDING,
      }),
    );
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('preserva a origem em uma edição parcial', async () => {
    plan.followUpPeriodId = 'period-follow-up';
    await service.update(
      plan.id,
      {
        action: 'Ação ajustada.',
        originEvaluationId: originEvaluation.id.toUpperCase(),
      },
      coordinator,
    );
    expect(manager.save).toHaveBeenCalledWith(
      ImprovementPlan,
      expect.objectContaining({
        originPeriodId: null,
        originEvaluationId: originEvaluation.id.toUpperCase(),
        followUpPeriodId: 'period-follow-up',
        status: Status.PENDING,
      }),
    );
  });

  it('rejeita edição parcial que deixaria duas origens', async () => {
    await expect(
      service.update(plan.id, { originPeriodId: period.id }, coordinator),
    ).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejeita edição vazia', () => {
    expect(() => service.update(plan.id, {}, coordinator)).toThrow(
      BadRequestException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('aplica todos os filtros à origem direta ou à avaliação no mesmo período e ao escopo do professor', async () => {
    const applied = {
      disciplineId: dto.disciplineId,
      status: Status.PENDING,
      assigneeId: professor.userId,
    };
    const results = await service.findAll(
      {
        disciplineId: applied.disciplineId,
        status: applied.status,
        originPeriodId: period.id,
      },
      professor,
    );
    expect(manager.find).toHaveBeenCalledWith(
      ImprovementPlan,
      expect.objectContaining({
        where: [
          { ...applied, originPeriodId: period.id },
          {
            ...applied,
            originEvaluation: { evaluationPeriod: { id: period.id } },
          },
        ],
      }),
    );
    expect(results[0]).not.toHaveProperty('history');
  });

  it('permite filtrar responsável na gestão e preserva o escopo do docente diante de outro responsável', async () => {
    await service.findAll({ assigneeId: 'prof-b' }, coordinator);
    expect(manager.find).toHaveBeenCalledWith(
      ImprovementPlan,
      expect.objectContaining({ where: { assigneeId: 'prof-b' } }),
    );
    manager.find.mockClear();
    await expect(
      service.findAll({ assigneeId: 'prof-b' }, professor),
    ).resolves.toEqual([]);
    expect(manager.find).not.toHaveBeenCalled();
  });

  it('oculta planos alheios no detalhe e na atualização de situação', async () => {
    const other = { ...professor, userId: 'prof-b' };
    await expect(service.findOne(plan.id, other)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.updateStatus(plan.id, { status: Status.COMPLETED }, other),
    ).rejects.toThrow(NotFoundException);
    expect(manager.find).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('permite ao professor responsável mudar situação e registra autor e situação anterior', async () => {
    manager.update.mockImplementation(async () => {
      plan.status = Status.IN_PROGRESS;
    });
    const result = await service.updateStatus(
      plan.id,
      { status: Status.IN_PROGRESS },
      professor,
    );
    expect(manager.findOne).toHaveBeenNthCalledWith(1, ImprovementPlan, {
      where: { id: plan.id, assigneeId: professor.userId },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      ImprovementPlan,
      { id: plan.id },
      { status: Status.IN_PROGRESS },
    );
    expect(manager.insert).toHaveBeenCalledWith(ImprovementPlanStatusHistory, {
      planId: plan.id,
      previousStatus: Status.PENDING,
      status: Status.IN_PROGRESS,
      changedAt: expect.any(Date),
      authorId: professor.userId,
    });
    expect(result.status).toBe(Status.IN_PROGRESS);
  });

  it('evita uma nova escrita ao receber a situação atual', async () => {
    await service.updateStatus(
      plan.id,
      { status: Status.PENDING },
      coordinator,
    );
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('bloqueia estudante e protege operações administrativas mesmo em chamadas diretas', async () => {
    expect(() => service.create(dto, professor)).toThrow(ForbiddenException);
    expect(() =>
      service.update(plan.id, { action: 'Outra' }, professor),
    ).toThrow(ForbiddenException);
    expect(() => service.findAssignees(professor)).toThrow(ForbiddenException);
    await expect(service.findAll({}, student)).rejects.toThrow(
      ForbiddenException,
    );
    expect(() => service.findOne(plan.id, student)).toThrow(ForbiddenException);
    expect(() =>
      service.updateStatus(plan.id, { status: Status.PENDING }, student),
    ).toThrow(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
    expect(manager.find).not.toHaveBeenCalled();
  });

  it('consulta os responsáveis ativos com uma projeção restrita e sem estudantes', async () => {
    await service.findAssignees(coordinator);
    expect(manager.find).toHaveBeenCalledWith(
      User,
      expect.objectContaining({
        where: {
          active: true,
          role: expect.objectContaining({
            value: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.PROFESSOR],
          }),
        },
        select: { id: true, name: true, role: true },
      }),
    );
  });
});
