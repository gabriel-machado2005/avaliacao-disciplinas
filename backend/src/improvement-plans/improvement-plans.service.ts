import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  QueryFailedError,
} from 'typeorm';
import { Discipline } from '../academic/entities/discipline.entity';
import { EvaluationPeriod } from '../evaluations/entities/evaluation-period.entity';
import { Evaluation } from '../evaluations/entities/evaluation.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  CreateImprovementPlanDto,
  ListImprovementPlansDto,
  UpdateImprovementPlanDto,
  UpdateImprovementPlanStatusDto,
} from './dto/improvement-plan.dto';
import { ImprovementPlanStatusHistory } from './entities/improvement-plan-status-history.entity';
import { recordAudit } from '../audit/administrative-audit';
import {
  ImprovementPlan,
  ImprovementPlanStatus,
} from './entities/improvement-plan.entity';
import {
  compareImprovementPlan,
  comparisonRelations,
} from './improvement-plan-comparison';

export type PlanRequester = { userId: string; role: UserRole };

const planRelations = {
  discipline: true,
  assignee: true,
  originPeriod: true,
  originEvaluation: { evaluationPeriod: true, classGroup: true },
} as const;

const assigneeRoles = [
  UserRole.ADMIN,
  UserRole.COORDINATOR,
  UserRole.PROFESSOR,
];

function presentPlan(plan: ImprovementPlan) {
  const {
    id,
    discipline,
    problem,
    action,
    assignee,
    dueDate,
    status,
    createdAt,
    updatedAt,
  } = plan;
  const evaluation = plan.originEvaluation;
  const period = evaluation?.evaluationPeriod ?? plan.originPeriod;

  return {
    id,
    discipline: {
      id: discipline.id,
      code: discipline.code,
      name: discipline.name,
    },
    problem,
    action,
    assignee: { id: assignee.id, name: assignee.name, role: assignee.role },
    dueDate,
    status,
    createdAt,
    updatedAt,
    originPeriod: period ? { id: period.id, name: period.name } : null,
    originEvaluation: evaluation
      ? { id: evaluation.id, classCode: evaluation.classGroup.code }
      : null,
  };
}

@Injectable()
export class ImprovementPlansService {
  constructor(private readonly dataSource: DataSource) {}

  async findAll(query: ListImprovementPlansDto, requester: PlanRequester) {
    const scope = this.accessScope(requester);
    if (
      scope.assigneeId &&
      query.assigneeId &&
      scope.assigneeId !== query.assigneeId.toLowerCase()
    ) {
      return [];
    }

    const filters: FindOptionsWhere<ImprovementPlan> = {
      ...scope,
      ...(query.disciplineId ? { disciplineId: query.disciplineId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    };
    const originPeriodId = query.originPeriodId;
    const plans = await this.dataSource.manager.find(ImprovementPlan, {
      where: originPeriodId
        ? [
            { ...filters, originPeriodId },
            {
              ...filters,
              originEvaluation: { evaluationPeriod: { id: originPeriodId } },
            },
          ]
        : filters,
      relations: planRelations,
      order: { createdAt: 'DESC', id: 'ASC' },
    });

    return plans.map(presentPlan);
  }

  findOne(id: string, requester: PlanRequester) {
    const scope = this.accessScope(requester);
    return this.dataSource.transaction('REPEATABLE READ', (manager) =>
      this.getDetail(manager, id, scope),
    );
  }

  getComparison(
    id: string,
    periodId: string | undefined,
    requester: PlanRequester,
  ) {
    this.requireManager(requester);
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const plan = await this.getComparisonPlan(manager, id);
      return compareImprovementPlan(manager, plan, periodId);
    });
  }

  async updateComparison(
    id: string,
    periodId: string | null,
    requester: PlanRequester,
  ) {
    this.requireManager(requester);
    try {
      return await this.dataSource.transaction(
        'REPEATABLE READ',
        async (manager) => {
          const plan = await this.getComparisonPlan(manager, id);
          const comparison = await compareImprovementPlan(
            manager,
            plan,
            periodId,
          );
          if (periodId && comparison.status !== 'AVAILABLE') {
            throw new BadRequestException(comparison.message);
          }

          const savedPeriodId = comparison.followUpPeriod?.id ?? null;
          if (plan.followUpPeriodId !== savedPeriodId) {
            await manager.update(
              ImprovementPlan,
              { id },
              { followUpPeriodId: savedPeriodId },
            );
            await recordAudit(
              manager,
              savedPeriodId ? 'SET_FOLLOW_UP' : 'CLEAR_FOLLOW_UP',
              'IMPROVEMENT_PLAN',
              id,
            );
          }

          return { ...comparison, savedPeriodId };
        },
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '40001'
      ) {
        throw new ConflictException(
          'O plano foi atualizado em outra consulta. Tente novamente.',
        );
      }
      throw error;
    }
  }

  findAssignees(requester: PlanRequester) {
    this.requireManager(requester);
    return this.dataSource.manager.find(User, {
      where: { active: true, role: In(assigneeRoles) },
      select: { id: true, name: true, role: true },
      order: { name: 'ASC', id: 'ASC' },
    });
  }

  create(dto: CreateImprovementPlanDto, requester: PlanRequester) {
    this.requireManager(requester);
    return this.dataSource.transaction(async (manager) => {
      if (!(await manager.existsBy(Discipline, { id: dto.disciplineId }))) {
        throw new BadRequestException('A disciplina informada não existe.');
      }

      const originPeriodId = dto.originPeriodId ?? null;
      const originEvaluationId = dto.originEvaluationId ?? null;
      await this.validateAssignee(manager, dto.assigneeId);
      await this.validateOrigin(
        manager,
        dto.disciplineId,
        originPeriodId,
        originEvaluationId,
      );

      const plan = await manager.save(ImprovementPlan, {
        disciplineId: dto.disciplineId,
        problem: dto.problem,
        action: dto.action,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate,
        originPeriodId,
        originEvaluationId,
        status: ImprovementPlanStatus.PENDING,
      });
      await this.recordStatus(
        manager,
        plan.id,
        null,
        plan.status,
        requester.userId,
      );
      await recordAudit(manager, 'CREATE', 'IMPROVEMENT_PLAN', plan.id);
      return this.getDetail(manager, plan.id, {});
    });
  }

  update(id: string, dto: UpdateImprovementPlanDto, requester: PlanRequester) {
    this.requireManager(requester);
    const {
      problem,
      action,
      assigneeId,
      dueDate,
      originPeriodId,
      originEvaluationId,
    } = dto;
    if (
      [
        problem,
        action,
        assigneeId,
        dueDate,
        originPeriodId,
        originEvaluationId,
      ].every((value) => value === undefined)
    ) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const plan = await this.lockPlan(manager, id, {});
      const previousFollowUpPeriodId = plan.followUpPeriodId;
      if (assigneeId && assigneeId.toLowerCase() !== plan.assigneeId) {
        await this.validateAssignee(manager, assigneeId);
        plan.assigneeId = assigneeId;
      }

      if (originPeriodId !== undefined || originEvaluationId !== undefined) {
        const period =
          originPeriodId === undefined ? plan.originPeriodId : originPeriodId;
        const evaluation =
          originEvaluationId === undefined
            ? plan.originEvaluationId
            : originEvaluationId;
        await this.validateOrigin(
          manager,
          plan.disciplineId,
          period,
          evaluation,
        );
        if (
          (period?.toLowerCase() ?? null) !== plan.originPeriodId ||
          (evaluation?.toLowerCase() ?? null) !== plan.originEvaluationId
        ) {
          plan.followUpPeriodId = null;
        }
        plan.originPeriodId = period;
        plan.originEvaluationId = evaluation;
      }

      plan.problem = problem ?? plan.problem;
      plan.action = action ?? plan.action;
      plan.dueDate = dueDate ?? plan.dueDate;
      await manager.save(ImprovementPlan, plan);
      await recordAudit(manager, 'UPDATE', 'IMPROVEMENT_PLAN', id);
      if (previousFollowUpPeriodId && !plan.followUpPeriodId) {
        await recordAudit(manager, 'CLEAR_FOLLOW_UP', 'IMPROVEMENT_PLAN', id);
      }
      return this.getDetail(manager, id, {});
    });
  }

  updateStatus(
    id: string,
    dto: UpdateImprovementPlanStatusDto,
    requester: PlanRequester,
  ) {
    const scope = this.accessScope(requester);
    return this.dataSource.transaction(async (manager) => {
      const plan = await this.lockPlan(manager, id, scope);
      if (plan.status !== dto.status) {
        const previousStatus = plan.status;
        await manager.update(ImprovementPlan, { id }, { status: dto.status });
        await this.recordStatus(
          manager,
          id,
          previousStatus,
          dto.status,
          requester.userId,
        );
      }

      return this.getDetail(manager, id, scope);
    });
  }

  private requireManager({ role }: PlanRequester) {
    if (role !== UserRole.ADMIN && role !== UserRole.COORDINATOR) {
      throw new ForbiddenException(
        'Você não possui acesso à gestão de planos de melhoria.',
      );
    }
  }

  private accessScope(
    requester: PlanRequester,
  ): FindOptionsWhere<ImprovementPlan> {
    if (requester.role === UserRole.PROFESSOR) {
      return { assigneeId: requester.userId.toLowerCase() };
    }

    this.requireManager(requester);
    return {};
  }

  private async lockPlan(
    manager: EntityManager,
    id: string,
    scope: FindOptionsWhere<ImprovementPlan>,
  ) {
    const plan = await manager.findOne(ImprovementPlan, {
      where: { ...scope, id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) {
      throw new NotFoundException('Plano de melhoria não encontrado.');
    }
    return plan;
  }

  private async getComparisonPlan(manager: EntityManager, id: string) {
    const plan = await manager.findOne(ImprovementPlan, {
      where: { id },
      relations: comparisonRelations,
    });
    if (!plan) {
      throw new NotFoundException('Plano de melhoria não encontrado.');
    }
    return plan;
  }

  private async getDetail(
    manager: EntityManager,
    id: string,
    scope: FindOptionsWhere<ImprovementPlan>,
  ) {
    const plan = await manager.findOne(ImprovementPlan, {
      where: { ...scope, id },
      relations: planRelations,
    });
    if (!plan) {
      throw new NotFoundException('Plano de melhoria não encontrado.');
    }

    const history = await manager.find(ImprovementPlanStatusHistory, {
      where: { planId: id },
      relations: { author: true },
      order: { id: 'DESC' },
    });

    return {
      ...presentPlan(plan),
      history: history.map(
        ({ id, previousStatus, status, changedAt, author }) => ({
          id,
          previousStatus,
          status,
          changedAt,
          author: { name: author.name },
        }),
      ),
    };
  }

  private async validateAssignee(manager: EntityManager, id: string) {
    if (
      !(await manager.existsBy(User, {
        id,
        role: In(assigneeRoles),
        active: true,
      }))
    ) {
      throw new BadRequestException(
        'Selecione um responsável ativo entre administradores, coordenadores e professores.',
      );
    }
  }

  private async validateOrigin(
    manager: EntityManager,
    disciplineId: string,
    periodId: string | null,
    evaluationId: string | null,
  ) {
    if (periodId && evaluationId) {
      throw new BadRequestException(
        'Selecione somente um período ou uma avaliação de origem.',
      );
    }

    if (
      periodId &&
      !(await manager.existsBy(EvaluationPeriod, { id: periodId }))
    ) {
      throw new BadRequestException(
        'O período de origem informado não existe.',
      );
    }

    if (evaluationId) {
      // O bloqueio serializa o vínculo com a edição da turma da avaliação.
      const evaluation = await manager.findOne(Evaluation, {
        where: { id: evaluationId },
        select: { id: true },
        lock: { mode: 'pessimistic_read' },
      });
      if (!evaluation) {
        throw new BadRequestException(
          'A avaliação de origem informada não existe.',
        );
      }

      if (
        !(await manager.existsBy(Evaluation, {
          id: evaluationId,
          classGroup: { discipline: { id: disciplineId } },
        }))
      ) {
        throw new BadRequestException(
          'A avaliação de origem deve pertencer à disciplina do plano.',
        );
      }
    }
  }

  private recordStatus(
    manager: EntityManager,
    planId: string,
    previousStatus: ImprovementPlanStatus | null,
    status: ImprovementPlanStatus,
    authorId: string,
  ) {
    return manager.insert(ImprovementPlanStatusHistory, {
      planId,
      previousStatus,
      status,
      authorId,
      changedAt: new Date(),
    });
  }
}
