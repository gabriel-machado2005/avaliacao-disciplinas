import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { UserRole } from '../users/entities/user.entity';

describe('EvaluationsController', () => {
  let controller: EvaluationsController;

  const evaluationsServiceMock = {
    createPeriod: jest.fn(),
    updatePeriod: jest.fn(),
    deletePeriod: jest.fn(),
    findPeriods: jest.fn(),
    createEvaluation: jest.fn(),
    deleteEvaluation: jest.fn(),
    updateEvaluation: jest.fn(),
    findEvaluations: jest.fn(),
    findProfessorEvaluations: jest.fn(),
    createEligibility: jest.fn(),
    findEligibilities: jest.fn(),
    findMyEvaluations: jest.fn(),
    findQuestionnaireForStudent: jest.fn(),
    submitEvaluation: jest.fn(),
    getResults: jest.fn(),
    updateEvaluationSettings: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvaluationsController],
      providers: [
        {
          provide: EvaluationsService,
          useValue: evaluationsServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<EvaluationsController>(EvaluationsController);
  });

  it('deve criar o controller de avaliações corretamente', () => {
    expect(controller).toBeDefined();
  });

  describe('Gerenciamento administrativo', () => {
    it('deve encaminhar o cadastro de um período de avaliação', async () => {
      const dto = {
        name: 'Avaliação 2027/1',
        startDate: '2027-03-01T00:00:00.000Z',
        endDate: '2027-03-31T23:59:59.000Z',
      };

      const period = {
        id: 'period-id-1',
        ...dto,
      };

      evaluationsServiceMock.createPeriod.mockResolvedValue(period);

      const result = await controller.createPeriod(dto);

      expect(evaluationsServiceMock.createPeriod).toHaveBeenCalledWith(dto);

      expect(evaluationsServiceMock.createPeriod).toHaveBeenCalledTimes(1);

      expect(result).toEqual(period);
    });

    it('deve encaminhar a edição de um período de avaliação ao serviço', async () => {
      const periodId = '550e8400-e29b-41d4-a716-446655440000';

      const dto = {
        name: 'Avaliação de Disciplinas 2027/1 - Revisada',
        endDate: '2027-04-15T23:59:59.000Z',
      };

      const updatedPeriod = {
        id: periodId,
        name: dto.name,
        startDate: '2027-03-01T00:00:00.000Z',
        endDate: dto.endDate,
        active: true,
      };

      evaluationsServiceMock.updatePeriod.mockResolvedValue(updatedPeriod);

      const result = await controller.updatePeriod(periodId, dto);

      expect(evaluationsServiceMock.updatePeriod).toHaveBeenCalledWith(
        periodId,
        dto,
      );

      expect(evaluationsServiceMock.updatePeriod).toHaveBeenCalledTimes(1);

      expect(result).toEqual(updatedPeriod);
    });

    it('deve encaminhar a exclusão de um período de avaliação ao serviço', async () => {
      const periodId = '550e8400-e29b-41d4-a716-446655440000';

      const response = {
        message: 'Período de avaliação excluído com sucesso.',
      };

      evaluationsServiceMock.deletePeriod.mockResolvedValue(response);

      const result = await controller.deletePeriod(periodId);

      expect(evaluationsServiceMock.deletePeriod).toHaveBeenCalledWith(
        periodId,
      );

      expect(evaluationsServiceMock.deletePeriod).toHaveBeenCalledTimes(1);

      expect(result).toEqual(response);
    });

    it('deve restringir a rota de exclusão de períodos ao administrador', () => {
      const roles = Reflect.getMetadata(
        'roles',
        EvaluationsController.prototype.deletePeriod,
      );

      expect(roles).toEqual([UserRole.ADMIN]);
    });

    it('deve retornar a lista de períodos de avaliação', async () => {
      const periods = [
        {
          id: 'period-id-1',
          name: 'Avaliação 2027/1',
        },
        {
          id: 'period-id-2',
          name: 'Avaliação 2027/2',
        },
      ];

      evaluationsServiceMock.findPeriods.mockResolvedValue(periods);

      const result = await controller.findPeriods();

      expect(evaluationsServiceMock.findPeriods).toHaveBeenCalledTimes(1);

      expect(result).toEqual(periods);
    });

    it('deve encaminhar o cadastro de uma avaliação', async () => {
      const dto = {
        evaluationPeriodId: 'period-id-1',
        classGroupId: 'class-group-id-1',
        questionnaireId: 'questionnaire-id-1',
        minResponsesForResults: 3,
      };

      const evaluation = {
        id: 'evaluation-id-1',
        ...dto,
      };

      evaluationsServiceMock.createEvaluation.mockResolvedValue(evaluation);

      const result = await controller.createEvaluation(dto);

      expect(evaluationsServiceMock.createEvaluation).toHaveBeenCalledWith(dto);

      expect(evaluationsServiceMock.createEvaluation).toHaveBeenCalledTimes(1);

      expect(result).toEqual(evaluation);
    });

    it('deve encaminhar a exclusão de uma avaliação ao serviço', async () => {
      const evaluationId = '550e8400-e29b-41d4-a716-446655440000';

      const response = {
        message: 'Avaliação excluída com sucesso.',
      };

      evaluationsServiceMock.deleteEvaluation.mockResolvedValue(response);

      const result = await controller.deleteEvaluation(evaluationId);

      expect(evaluationsServiceMock.deleteEvaluation).toHaveBeenCalledWith(
        evaluationId,
      );

      expect(evaluationsServiceMock.deleteEvaluation).toHaveBeenCalledTimes(1);

      expect(result).toEqual(response);
    });

    it('deve encaminhar a edição de uma avaliação ao serviço', async () => {
      const evaluationId = '550e8400-e29b-41d4-a716-446655440000';

      const dto = {
        questionnaireId: '660e8400-e29b-41d4-a716-446655440001',
        minResponsesForResults: 5,
      };

      const updatedEvaluation = {
        id: evaluationId,
        evaluationPeriod: {
          id: '770e8400-e29b-41d4-a716-446655440002',
        },
        classGroup: {
          id: '880e8400-e29b-41d4-a716-446655440003',
        },
        questionnaire: {
          id: dto.questionnaireId,
        },
        minResponsesForResults: dto.minResponsesForResults,
      };

      evaluationsServiceMock.updateEvaluation.mockResolvedValue(
        updatedEvaluation,
      );

      const result = await controller.updateEvaluation(evaluationId, dto);

      expect(evaluationsServiceMock.updateEvaluation).toHaveBeenCalledWith(
        evaluationId,
        dto,
      );

      expect(evaluationsServiceMock.updateEvaluation).toHaveBeenCalledTimes(1);

      expect(result).toEqual(updatedEvaluation);
    });

    it('deve restringir a exclusão de avaliações aos administradores', () => {
      const roles = Reflect.getMetadata(
        'roles',
        EvaluationsController.prototype.deleteEvaluation,
      );

      expect(roles).toEqual([UserRole.ADMIN]);
    });

    it('deve retornar a lista de avaliações cadastradas', async () => {
      const evaluations = [
        {
          id: 'evaluation-id-1',
          minResponsesForResults: 3,
        },
        {
          id: 'evaluation-id-2',
          minResponsesForResults: 5,
        },
      ];

      evaluationsServiceMock.findEvaluations.mockResolvedValue(evaluations);

      const result = await controller.findEvaluations();

      expect(evaluationsServiceMock.findEvaluations).toHaveBeenCalledTimes(1);

      expect(result).toEqual(evaluations);
    });

    it('deve encaminhar a habilitação de um estudante', async () => {
      const dto = {
        evaluationId: 'evaluation-id-1',
        studentId: 'student-id-1',
      };

      const eligibility = {
        id: 'eligibility-id-1',
        completed: false,
        ...dto,
      };

      evaluationsServiceMock.createEligibility.mockResolvedValue(eligibility);

      const result = await controller.createEligibility(dto);

      expect(evaluationsServiceMock.createEligibility).toHaveBeenCalledWith(
        dto,
      );

      expect(evaluationsServiceMock.createEligibility).toHaveBeenCalledTimes(1);

      expect(result).toEqual(eligibility);
    });

    it('deve consultar as elegibilidades de uma avaliação', async () => {
      const evaluationId = 'evaluation-id-1';

      const eligibilities = [
        {
          id: 'eligibility-id-1',
          completed: false,
          student: {
            id: 'student-id-1',
            name: 'Estudante de Teste',
          },
        },
      ];

      evaluationsServiceMock.findEligibilities.mockResolvedValue(eligibilities);

      const result = await controller.findEligibilities(evaluationId);

      expect(evaluationsServiceMock.findEligibilities).toHaveBeenCalledWith(
        evaluationId,
      );

      expect(evaluationsServiceMock.findEligibilities).toHaveBeenCalledTimes(1);

      expect(result).toEqual(eligibilities);
    });
  });

  describe('Operações dos professores e estudantes', () => {
    it('deve consultar as avaliações do professor autenticado', async () => {
      const req = {
        user: {
          userId: 'professor-id-1',
          role: UserRole.PROFESSOR,
        },
      };

      const evaluations = [
        {
          id: 'evaluation-id-1',
          classGroup: {
            professor: {
              id: req.user.userId,
            },
          },
        },
      ];

      evaluationsServiceMock.findProfessorEvaluations.mockResolvedValue(
        evaluations,
      );

      const result = await controller.findProfessorEvaluations(req);

      expect(
        evaluationsServiceMock.findProfessorEvaluations,
      ).toHaveBeenCalledWith('professor-id-1');

      expect(
        evaluationsServiceMock.findProfessorEvaluations,
      ).toHaveBeenCalledTimes(1);

      expect(result).toEqual(evaluations);
    });

    it('deve consultar as avaliações do estudante autenticado', async () => {
      const req = {
        user: {
          userId: 'student-id-1',
          role: UserRole.STUDENT,
        },
      };

      const evaluations = [
        {
          id: 'eligibility-id-1',
          completed: false,
          evaluation: {
            id: 'evaluation-id-1',
          },
        },
      ];

      evaluationsServiceMock.findMyEvaluations.mockResolvedValue(evaluations);

      const result = await controller.findMyEvaluations(req);

      expect(evaluationsServiceMock.findMyEvaluations).toHaveBeenCalledWith(
        'student-id-1',
      );

      expect(evaluationsServiceMock.findMyEvaluations).toHaveBeenCalledTimes(1);

      expect(result).toEqual(evaluations);
    });

    it('deve encaminhar a consulta do questionário do estudante', async () => {
      const evaluationId = 'evaluation-id-1';

      const req = {
        user: {
          userId: 'student-id-1',
          role: UserRole.STUDENT,
        },
      };

      const questionnaireData = {
        evaluationId,
        questionnaire: {
          id: 'questionnaire-id-1',
          name: 'Avaliação Geral',
          dimensions: [],
        },
      };

      evaluationsServiceMock.findQuestionnaireForStudent.mockResolvedValue(
        questionnaireData,
      );

      const result = await controller.getQuestionnaireForStudent(
        evaluationId,
        req,
      );

      expect(
        evaluationsServiceMock.findQuestionnaireForStudent,
      ).toHaveBeenCalledWith(evaluationId, 'student-id-1');

      expect(result).toEqual(questionnaireData);
    });

    it('deve encaminhar o envio das respostas do estudante', async () => {
      const evaluationId = 'evaluation-id-1';

      const req = {
        user: {
          userId: 'student-id-1',
          role: UserRole.STUDENT,
        },
      };

      const dto = {
        answers: [
          {
            questionId: 'question-id-1',
            scaleValue: 5,
          },
        ],
      };

      const submission = {
        submissionId: 'submission-id-1',
        evaluationId,
        submittedAt: new Date('2027-03-15T10:00:00.000Z'),
        answersCount: 1,
      };

      evaluationsServiceMock.submitEvaluation.mockResolvedValue(submission);

      const result = await controller.submitEvaluation(evaluationId, req, dto);

      expect(evaluationsServiceMock.submitEvaluation).toHaveBeenCalledWith(
        evaluationId,
        'student-id-1',
        dto,
      );

      expect(evaluationsServiceMock.submitEvaluation).toHaveBeenCalledTimes(1);

      expect(result).toEqual(submission);
    });
  });

  describe('Resultados e configurações', () => {
    it('deve encaminhar a consulta de resultados com os dados do usuário autenticado', async () => {
      const evaluationId = 'evaluation-id-1';

      const req = {
        user: {
          userId: 'professor-id-1',
          role: UserRole.PROFESSOR,
        },
      };

      const results = {
        evaluation: {
          id: evaluationId,
        },
        participation: {
          eligible: 10,
          responses: 5,
          rate: 50,
        },
        dimensions: [],
      };

      evaluationsServiceMock.getResults.mockResolvedValue(results);

      const result = await controller.getResults(evaluationId, req);

      expect(evaluationsServiceMock.getResults).toHaveBeenCalledWith(
        evaluationId,
        req.user,
      );

      expect(evaluationsServiceMock.getResults).toHaveBeenCalledTimes(1);

      expect(result).toEqual(results);
    });

    it('deve encaminhar a atualização das configurações da avaliação', async () => {
      const evaluationId = 'evaluation-id-1';

      const dto = {
        minResponsesForResults: 5,
      };

      const updatedEvaluation = {
        id: evaluationId,
        minResponsesForResults: 5,
      };

      evaluationsServiceMock.updateEvaluationSettings.mockResolvedValue(
        updatedEvaluation,
      );

      const result = await controller.updateEvaluationSettings(
        evaluationId,
        dto,
      );

      expect(
        evaluationsServiceMock.updateEvaluationSettings,
      ).toHaveBeenCalledWith(evaluationId, dto);

      expect(
        evaluationsServiceMock.updateEvaluationSettings,
      ).toHaveBeenCalledTimes(1);

      expect(result).toEqual(updatedEvaluation);
    });
  });
});
