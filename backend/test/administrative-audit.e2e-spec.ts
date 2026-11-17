import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, EntityManager, type Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  AdministrativeAuditEvent,
  type AuditAction,
  type AuditResource,
} from '../src/audit/administrative-audit.entity';
import { Course } from '../src/academic/entities/course.entity';
import { Answer } from '../src/evaluations/entities/answer.entity';
import { Submission } from '../src/evaluations/entities/submission.entity';
import { ImprovementPlanStatus } from '../src/improvement-plans/entities/improvement-plan.entity';
import { UserRole } from '../src/users/entities/user.entity';
import { UsersService } from '../src/users/users.service';

const dataDirectory = process.env.UNIXS_AUDIT_TEST_DATA_DIRECTORY;
const describeIsolated = dataDirectory ? describe : describe.skip;

async function confirmIsolatedDatabase(expectedDirectory: string) {
  if (
    process.env.DB_HOST !== '127.0.0.1' ||
    process.env.DB_PORT !== '55487' ||
    process.env.DB_DATABASE !== 'unixs_audit_test' ||
    process.env.DB_USERNAME !== 'unixs_audit_test'
  ) {
    throw new Error('Use o PostgreSQL isolado da suíte de auditoria.');
  }

  const connection = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 55487,
    database: 'unixs_audit_test',
    username: 'unixs_audit_test',
    password: process.env.DB_PASSWORD,
    extra: { options: '-c default_transaction_read_only=on' },
    synchronize: false,
  });
  await connection.initialize();
  try {
    const [identity] = await connection.query<
      { db: string; port: number; address: string; directory: string }[]
    >(
      "SELECT current_database() AS db, inet_server_port() AS port, host(inet_server_addr()) AS address, current_setting('data_directory') AS directory",
    );
    if (
      identity.db !== 'unixs_audit_test' ||
      identity.port !== 55487 ||
      identity.address !== '127.0.0.1' ||
      (await realpath(identity.directory)) !==
        (await realpath(expectedDirectory))
    ) {
      throw new Error('Identidade do PostgreSQL isolado divergente.');
    }
  } finally {
    await connection.destroy();
  }
}

describeIsolated('Auditoria administrativa no PostgreSQL isolado', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let events: Repository<AdministrativeAuditEvent>;
  let admin: { id: string; auth: string };
  let coordinator: { id: string; auth: string };
  let professor: { id: string; auth: string };
  let student: { id: string; auth: string };
  let fixture: Awaited<ReturnType<typeof createEvaluationFixtures>>;
  const prefix = randomUUID().slice(0, 8);

  const http = () => request(app.getHttpServer());
  const resultId = (response: { body: { id: string } }) => response.body.id;

  async function expectEvent(
    actorId: string,
    action: AuditAction,
    resourceType: AuditResource,
    resourceId: string,
  ) {
    const matching = await events.findBy({
      actorId,
      action,
      resourceType,
      resourceId,
    });
    expect(matching).toEqual([
      {
        id: expect.any(String),
        actorId,
        action,
        resourceType,
        resourceId,
        occurredAt: expect.any(Date),
      },
    ]);
  }

  async function newActor(role: UserRole) {
    const user = await app.get(UsersService).create({
      name: 'Conta de teste',
      email: prefix + '-' + role.toLowerCase() + '@example.test',
      password: 'So-para-testes-123',
      role,
    });
    const token = await app.get(JwtService).signAsync({ sub: user.id });
    return { id: user.id, auth: 'Bearer ' + token };
  }

  beforeAll(async () => {
    await confirmIsolatedDatabase(dataDirectory!);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);
    events = dataSource.getRepository(AdministrativeAuditEvent);
    [admin, coordinator, professor, student] = await Promise.all([
      newActor(UserRole.ADMIN),
      newActor(UserRole.COORDINATOR),
      newActor(UserRole.PROFESSOR),
      newActor(UserRole.STUDENT),
    ]);
    fixture = await createEvaluationFixtures();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('registra somente os metadados permitidos ao cadastrar uma conta', async () => {
    const user = {
      name: 'Professor fictício',
      email: prefix + '-novo@example.test',
      password: 'Senha-exclusiva-do-teste',
      role: UserRole.PROFESSOR,
    };
    const response = await http()
      .post('/users')
      .set('Authorization', admin.auth)
      .send(user)
      .expect(201);
    const userId = resultId(response);
    await expectEvent(admin.id, 'CREATE', 'USER', userId);
    const event = await events.findOneByOrFail({ resourceId: userId });
    const contents = JSON.stringify(event);
    for (const sensitive of [
      user.name,
      user.email,
      user.password,
      'passwordHash',
      admin.auth,
    ]) {
      expect(contents).not.toContain(sensitive);
    }
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('associa o autor correto em requisições simultâneas e audita edições e exclusões acadêmicas', async () => {
    const [createdByAdmin, createdByCoordinator] = await Promise.all([
      http()
        .post('/academic/courses')
        .set('Authorization', admin.auth)
        .send({ code: prefix + '-A', name: 'Curso A' })
        .expect(201),
      http()
        .post('/academic/courses')
        .set('Authorization', coordinator.auth)
        .send({ code: prefix + '-B', name: 'Curso B' })
        .expect(201),
    ]);
    const courseA = resultId(createdByAdmin);
    const courseB = resultId(createdByCoordinator);
    await expectEvent(admin.id, 'CREATE', 'COURSE', courseA);
    await expectEvent(coordinator.id, 'CREATE', 'COURSE', courseB);
    await http()
      .patch('/academic/courses/' + courseB)
      .set('Authorization', coordinator.auth)
      .send({ name: 'Curso revisado' })
      .expect(200);
    await expectEvent(coordinator.id, 'UPDATE', 'COURSE', courseB);
    await http()
      .delete('/academic/courses/' + courseB)
      .set('Authorization', admin.auth)
      .expect(200);
    await expectEvent(admin.id, 'DELETE', 'COURSE', courseB);
  });

  it('não grava eventos para operações rejeitadas, consultas ou requisições anônimas', async () => {
    const before = await events.count();
    const body = { code: prefix + '-denied', name: 'Curso restrito' };
    await http().post('/academic/courses').send(body).expect(401);
    await http()
      .post('/academic/courses')
      .set('Authorization', student.auth)
      .send(body)
      .expect(403);
    await http()
      .post('/academic/courses')
      .set('Authorization', admin.auth)
      .send({ ...body, actorId: student.id })
      .expect(400);
    await http()
      .patch('/academic/courses/' + randomUUID())
      .set('Authorization', admin.auth)
      .send({ name: 'Curso inexistente' })
      .expect(404);
    await http()
      .get('/academic/courses')
      .set('Authorization', admin.auth)
      .expect(200);
    await http().get('/audit').set('Authorization', student.auth).expect(404);
    expect(await events.count()).toBe(before);
  });

  async function createEvaluationFixtures() {
    const auth = coordinator.auth;
    const course = resultId(
      await http()
        .post('/academic/courses')
        .set('Authorization', auth)
        .send({ code: prefix + '-EV', name: 'Curso do cenário' })
        .expect(201),
    );
    const discipline = resultId(
      await http()
        .post('/academic/disciplines')
        .set('Authorization', auth)
        .send({
          code: prefix + '-DS',
          name: 'Disciplina do cenário',
          courseId: course,
        })
        .expect(201),
    );
    const term = resultId(
      await http()
        .post('/academic/terms')
        .set('Authorization', auth)
        .send({
          code: prefix + '-2020',
          startDate: '2020-01-01',
          endDate: '2020-12-31',
        })
        .expect(201),
    );
    const classGroup = resultId(
      await http()
        .post('/academic/classes')
        .set('Authorization', auth)
        .send({
          code: prefix + '-T',
          disciplineId: discipline,
          academicTermId: term,
          professorId: professor.id,
        })
        .expect(201),
    );
    const questionnaire = resultId(
      await http()
        .post('/questionnaires')
        .set('Authorization', auth)
        .send({ name: 'Questionário fictício' })
        .expect(201),
    );
    await http()
      .patch('/questionnaires/' + questionnaire)
      .set('Authorization', auth)
      .send({ description: 'Descrição fictícia' })
      .expect(200);
    const dimension = resultId(
      await http()
        .post('/questionnaires/' + questionnaire + '/dimensions')
        .set('Authorization', auth)
        .send({ name: 'Dimensão fictícia' })
        .expect(201),
    );
    const question = resultId(
      await http()
        .post('/questionnaires/dimensions/' + dimension + '/questions')
        .set('Authorization', auth)
        .send({
          text: 'Questão de escala fictícia',
          type: 'SCALE',
          scaleMin: 1,
          scaleMax: 5,
        })
        .expect(201),
    );
    const originPeriod = resultId(
      await http()
        .post('/evaluations/periods')
        .set('Authorization', auth)
        .send({
          name: 'Origem',
          startDate: '2020-04-01',
          endDate: '2020-04-10',
        })
        .expect(201),
    );
    const followUpPeriod = resultId(
      await http()
        .post('/evaluations/periods')
        .set('Authorization', auth)
        .send({
          name: 'Acompanhamento',
          startDate: '2020-09-01',
          endDate: '2020-09-10',
        })
        .expect(201),
    );
    const evaluationBody = {
      classGroupId: classGroup,
      questionnaireId: questionnaire,
      minResponsesForResults: 2,
    };
    const origin = resultId(
      await http()
        .post('/evaluations')
        .set('Authorization', auth)
        .send({ ...evaluationBody, evaluationPeriodId: originPeriod })
        .expect(201),
    );
    const followUp = resultId(
      await http()
        .post('/evaluations')
        .set('Authorization', auth)
        .send({ ...evaluationBody, evaluationPeriodId: followUpPeriod })
        .expect(201),
    );
    return {
      course,
      discipline,
      term,
      classGroup,
      questionnaire,
      dimension,
      question,
      originPeriod,
      followUpPeriod,
      origin,
      followUp,
    };
  }

  it('audita configurações acadêmicas, questionário, avaliação e elegibilidade com o ID da avaliação', async () => {
    for (const [type, id] of [
      ['DISCIPLINE', fixture.discipline],
      ['ACADEMIC_TERM', fixture.term],
      ['CLASS_GROUP', fixture.classGroup],
      ['QUESTIONNAIRE', fixture.questionnaire],
      ['DIMENSION', fixture.dimension],
      ['QUESTION', fixture.question],
      ['EVALUATION_PERIOD', fixture.originPeriod],
      ['EVALUATION', fixture.origin],
    ] as const) {
      await expectEvent(coordinator.id, 'CREATE', type, id);
    }
    await expectEvent(
      coordinator.id,
      'UPDATE',
      'QUESTIONNAIRE',
      fixture.questionnaire,
    );
    const eligibilityPath = '/evaluations/eligibilities';
    const eligibilityBody = {
      evaluationId: fixture.origin,
      studentId: student.id,
    };
    const eligibility = resultId(
      await http()
        .post(eligibilityPath)
        .set('Authorization', coordinator.auth)
        .send(eligibilityBody)
        .expect(201),
    );
    await http()
      .post(eligibilityPath)
      .set('Authorization', coordinator.auth)
      .send(eligibilityBody)
      .expect(400);
    await http()
      .delete(eligibilityPath + '/' + eligibility)
      .set('Authorization', coordinator.auth)
      .expect(200);
    await http()
      .delete(eligibilityPath + '/' + eligibility)
      .set('Authorization', coordinator.auth)
      .expect(404);
    await expectEvent(
      coordinator.id,
      'GRANT_ELIGIBILITY',
      'EVALUATION',
      fixture.origin,
    );
    await expectEvent(
      coordinator.id,
      'REVOKE_ELIGIBILITY',
      'EVALUATION',
      fixture.origin,
    );
    for (const action of ['GRANT_ELIGIBILITY', 'REVOKE_ELIGIBILITY'] as const) {
      const event = await events.findOneByOrFail({
        action,
        resourceId: fixture.origin,
      });
      expect(JSON.stringify(event)).not.toContain(student.id);
      expect(JSON.stringify(event)).not.toContain(eligibility);
    }
    const evaluationPath = '/evaluations/' + fixture.origin;
    await http()
      .patch(evaluationPath)
      .set('Authorization', coordinator.auth)
      .send({ minResponsesForResults: 3 })
      .expect(200);
    await expectEvent(
      coordinator.id,
      'UPDATE_MIN_RESPONSES',
      'EVALUATION',
      fixture.origin,
    );
    await http()
      .patch(evaluationPath + '/settings')
      .set('Authorization', admin.auth)
      .send({ minResponsesForResults: 2 })
      .expect(200);
    await expectEvent(
      admin.id,
      'UPDATE_MIN_RESPONSES',
      'EVALUATION',
      fixture.origin,
    );
  }, 30_000);

  it('audita edição e acompanhamento do plano e mantém o histórico de situação do professor', async () => {
    for (const [evaluationId, scaleValue] of [
      [fixture.origin, 2],
      [fixture.followUp, 4],
    ] as const) {
      for (let i = 0; i < 2; i++) {
        const submission = await dataSource.manager.save(Submission, {
          evaluation: { id: evaluationId },
        });
        await dataSource.manager.save(Answer, {
          submission,
          question: { id: fixture.question },
          scaleValue,
        });
      }
    }
    const plan = resultId(
      await http()
        .post('/improvement-plans')
        .set('Authorization', coordinator.auth)
        .send({
          disciplineId: fixture.discipline,
          problem: 'Problema fictício',
          action: 'Ação fictícia',
          assigneeId: professor.id,
          dueDate: '2020-09-01',
          originEvaluationId: fixture.origin,
        })
        .expect(201),
    );
    const path = '/improvement-plans/' + plan;
    await expectEvent(coordinator.id, 'CREATE', 'IMPROVEMENT_PLAN', plan);
    await http()
      .patch(path)
      .set('Authorization', professor.auth)
      .send({ problem: 'Edição proibida' })
      .expect(403);
    await http()
      .patch(path)
      .set('Authorization', coordinator.auth)
      .send({ action: 'Ação revisada' })
      .expect(200);
    await expectEvent(coordinator.id, 'UPDATE', 'IMPROVEMENT_PLAN', plan);
    await http()
      .patch(path + '/comparison')
      .set('Authorization', coordinator.auth)
      .send({ periodId: fixture.originPeriod })
      .expect(400);
    await http()
      .patch(path + '/comparison')
      .set('Authorization', coordinator.auth)
      .send({ periodId: fixture.followUpPeriod })
      .expect(200);
    await expectEvent(
      coordinator.id,
      'SET_FOLLOW_UP',
      'IMPROVEMENT_PLAN',
      plan,
    );
    await http()
      .patch(path + '/comparison')
      .set('Authorization', coordinator.auth)
      .send({ periodId: null })
      .expect(200);
    await expectEvent(
      coordinator.id,
      'CLEAR_FOLLOW_UP',
      'IMPROVEMENT_PLAN',
      plan,
    );
    await http()
      .patch(path + '/comparison')
      .set('Authorization', admin.auth)
      .send({ periodId: fixture.followUpPeriod })
      .expect(200);
    await http()
      .patch(path)
      .set('Authorization', admin.auth)
      .send({ originEvaluationId: null, originPeriodId: fixture.originPeriod })
      .expect(200);
    await expectEvent(admin.id, 'SET_FOLLOW_UP', 'IMPROVEMENT_PLAN', plan);
    await expectEvent(admin.id, 'UPDATE', 'IMPROVEMENT_PLAN', plan);
    await expectEvent(admin.id, 'CLEAR_FOLLOW_UP', 'IMPROVEMENT_PLAN', plan);
    const change = await http()
      .patch(path + '/status')
      .set('Authorization', professor.auth)
      .send({ status: ImprovementPlanStatus.COMPLETED })
      .expect(200);
    expect(change.body.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: ImprovementPlanStatus.PENDING }),
        expect.objectContaining({ status: ImprovementPlanStatus.COMPLETED }),
      ]),
    );
    expect(await events.countBy({ resourceId: plan })).toBe(7);
    expect(
      JSON.stringify(await events.findBy({ resourceId: plan })),
    ).not.toContain('Ação revisada');
  }, 30_000);

  it('reverte a alteração original se a gravação de auditoria falhar', async () => {
    const insert = jest
      .spyOn(EntityManager.prototype, 'insert')
      .mockRejectedValueOnce(new Error('falha de auditoria simulada'));
    const code = prefix + '-rollback';
    const before = await events.count();
    try {
      await http()
        .post('/academic/courses')
        .set('Authorization', admin.auth)
        .send({ code, name: 'Curso a reverter' })
        .expect(500);
      expect(insert).toHaveBeenCalledWith(
        AdministrativeAuditEvent,
        expect.objectContaining({
          actorId: admin.id,
          action: 'CREATE',
          resourceType: 'COURSE',
        }),
      );
    } finally {
      insert.mockRestore();
    }
    expect(await dataSource.getRepository(Course).existsBy({ code })).toBe(
      false,
    );
    expect(await events.count()).toBe(before);
  });
});
