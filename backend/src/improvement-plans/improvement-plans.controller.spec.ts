import {
  BadRequestException,
  type ExecutionContext,
  Global,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import {
  CreateImprovementPlanDto,
  ImprovementPlanComparisonQueryDto,
  ListImprovementPlansDto,
  UpdateImprovementPlanDto,
  UpdateImprovementPlanComparisonDto,
  UpdateImprovementPlanStatusDto,
} from './dto/improvement-plan.dto';
import { ImprovementPlanStatus } from './entities/improvement-plan.entity';
import { ImprovementPlansController } from './improvement-plans.controller';
import { ImprovementPlansModule } from './improvement-plans.module';

@Global()
@Module({
  providers: [
    {
      provide: DataSource,
      useValue: {
        entityMetadatas: [],
        options: { type: 'postgres' },
        getRepository: () => ({}),
      },
    },
  ],
  exports: [DataSource],
})
class TestDataSourceModule {}

describe('Rotas e DTOs de planos de melhoria', () => {
  const controller = ImprovementPlansController;
  const guard = new RolesGuard(new Reflector());
  const uuid = '098ea1be-a0d9-47f4-9edc-4877c10ad03a';
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const createBody = {
    disciplineId: uuid,
    assigneeId: uuid,
    problem: ' Problema identificado. ',
    action: ' Revisar materiais. ',
    dueDate: '2027-02-28',
  };

  function allows(method: keyof ImprovementPlansController, role: UserRole) {
    return guard.canActivate({
      getHandler: () => controller.prototype[method],
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext);
  }

  it('protege o controller com os guards de JWT e perfil', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it('inicializa o módulo com as dependências do guard JWT', async () => {
    const module = await Test.createTestingModule({
      imports: [TestDataSourceModule, ImprovementPlansModule],
    }).compile();
    try {
      expect(module.get(ImprovementPlansController)).toBeDefined();
    } finally {
      await module.close();
    }
  });

  it.each([
    'create',
    'update',
    'findAssignees',
    'getComparison',
    'updateComparison',
  ] as const)('restringe a gestão em %s', (method) => {
    expect(allows(method, UserRole.ADMIN)).toBe(true);
    expect(allows(method, UserRole.COORDINATOR)).toBe(true);
    expect(allows(method, UserRole.PROFESSOR)).toBe(false);
    expect(allows(method, UserRole.STUDENT)).toBe(false);
  });

  it.each(['findAll', 'findOne', 'updateStatus'] as const)(
    'permite acompanhamento por docentes em %s',
    (method) => {
      expect(allows(method, UserRole.ADMIN)).toBe(true);
      expect(allows(method, UserRole.COORDINATOR)).toBe(true);
      expect(allows(method, UserRole.PROFESSOR)).toBe(true);
      expect(allows(method, UserRole.STUDENT)).toBe(false);
    },
  );

  it('normaliza os textos do plano antes da validação', async () => {
    await expect(
      pipe.transform(createBody, {
        type: 'body',
        metatype: CreateImprovementPlanDto,
      }),
    ).resolves.toMatchObject({
      problem: 'Problema identificado.',
      action: 'Revisar materiais.',
    });
  });

  it('valida o período de comparação e aceita a remoção explícita pelo PATCH', async () => {
    await expect(
      pipe.transform(
        { periodId: uuid },
        { type: 'query', metatype: ImprovementPlanComparisonQueryDto },
      ),
    ).resolves.toMatchObject({ periodId: uuid });
    await expect(
      pipe.transform(
        { periodId: [uuid, uuid] },
        { type: 'query', metatype: ImprovementPlanComparisonQueryDto },
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform(
        { periodId: null },
        { type: 'body', metatype: UpdateImprovementPlanComparisonDto },
      ),
    ).resolves.toMatchObject({ periodId: null });
    await expect(
      pipe.transform(
        {},
        { type: 'body', metatype: UpdateImprovementPlanComparisonDto },
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform(
        { periodId: uuid, status: ImprovementPlanStatus.COMPLETED },
        { type: 'body', metatype: UpdateImprovementPlanComparisonDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it.each([
    { problem: '  ' },
    { action: 'x'.repeat(2001) },
    { dueDate: '2027-02-29' },
    { dueDate: '2027-02-28T00:00:00Z' },
    { dueDate: '0000-02-28' },
    { disciplineId: 'invalido' },
    { originEvaluationId: 'invalido' },
    { status: ImprovementPlanStatus.COMPLETED },
    { authorId: uuid },
  ])(
    'rejeita valores inválidos e campos protegidos no cadastro (%j)',
    async (patch) => {
      await expect(
        pipe.transform(
          { ...createBody, ...patch },
          { type: 'body', metatype: CreateImprovementPlanDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('aceita edição parcial e remoção explícita do vínculo opcional', async () => {
    await expect(
      pipe.transform(
        { action: ' Ajustar exercícios. ', originEvaluationId: null },
        {
          type: 'body',
          metatype: UpdateImprovementPlanDto,
        },
      ),
    ).resolves.toMatchObject({
      action: 'Ajustar exercícios.',
      originEvaluationId: null,
    });
  });

  it.each([
    { disciplineId: uuid },
    { problem: null },
    { dueDate: null },
    { assigneeId: null },
    { status: ImprovementPlanStatus.PENDING },
    { createdAt: '2026-11-17' },
  ])(
    'rejeita campos protegidos e valores nulos obrigatórios na edição (%j)',
    async (body) => {
      await expect(
        pipe.transform(body, {
          type: 'body',
          metatype: UpdateImprovementPlanDto,
        }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it.each([
    {},
    { status: 'CONCLUIDA' },
    { status: ImprovementPlanStatus.COMPLETED, assigneeId: uuid },
    { status: ImprovementPlanStatus.COMPLETED, authorId: uuid },
  ])(
    'rejeita outros campos e situações inválidas no endpoint de situação (%j)',
    async (body) => {
      await expect(
        pipe.transform(body, {
          type: 'body',
          metatype: UpdateImprovementPlanStatusDto,
        }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it.each([
    { disciplineId: 'invalido' },
    { originPeriodId: [uuid, uuid] },
    { status: 'invalido' },
    { userId: uuid },
  ])('valida os filtros de listagem (%j)', async (query) => {
    await expect(
      pipe.transform(query, {
        type: 'query',
        metatype: ListImprovementPlansDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
