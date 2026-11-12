import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { EvaluationsService } from './evaluations.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { QuestionType } from '../questionnaires/entities/question.entity';
import { Answer } from './entities/answer.entity';
import { EvaluationEligibility } from './entities/evaluation-eligibility.entity';
import { Evaluation } from './entities/evaluation.entity';
import { Submission } from './entities/submission.entity';

describe('EvaluationsService', () => {
  let service: EvaluationsService;
  const evaluationPeriodRepositoryMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const createRepositoryMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  });

  const evaluationRepositoryMock = createRepositoryMock();
  const classGroupRepositoryMock = createRepositoryMock();
  const questionnaireRepositoryMock = createRepositoryMock();
  const evaluationEligibilityRepositoryMock = createRepositoryMock();
  const userRepositoryMock = createRepositoryMock();

  const dataSourceMock = {
    transaction: jest.fn(),
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationsService,
        {
          provide: 'EvaluationPeriodRepository',
          useValue: evaluationPeriodRepositoryMock,
        },
        {
          provide: 'EvaluationRepository',
          useValue: evaluationRepositoryMock,
        },
        {
          provide: 'ClassGroupRepository',
          useValue: classGroupRepositoryMock,
        },
        {
          provide: 'QuestionnaireRepository',
          useValue: questionnaireRepositoryMock,
        },
        {
          provide: 'EvaluationEligibilityRepository',
          useValue: evaluationEligibilityRepositoryMock,
        },
        {
          provide: 'UserRepository',
          useValue: userRepositoryMock,
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<EvaluationsService>(EvaluationsService);
  });

  it('deve criar o serviço de avaliações corretamente', () => {
    expect(service).toBeDefined();
  });

  describe('Períodos de avaliação', () => {
    it('deve cadastrar um período de avaliação válido', async () => {
      const dto = {
        name: 'Avaliação 2027/1',
        startDate: '2027-03-01T00:00:00.000Z',
        endDate: '2027-03-31T23:59:59.000Z',
      };

      const period = {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      };

      const savedPeriod = {
        id: 'period-id-1',
        ...period,
      };

      evaluationPeriodRepositoryMock.create.mockReturnValue(period);

      evaluationPeriodRepositoryMock.save.mockResolvedValue(savedPeriod);

      const result = await service.createPeriod(dto);

      expect(evaluationPeriodRepositoryMock.create).toHaveBeenCalledWith({
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      });

      expect(evaluationPeriodRepositoryMock.save).toHaveBeenCalledWith(period);

      expect(result).toEqual(savedPeriod);
    });

    it('deve rejeitar um período com data final anterior à inicial', async () => {
      const dto = {
        name: 'Período Inválido',
        startDate: '2027-03-20T00:00:00.000Z',
        endDate: '2027-03-10T00:00:00.000Z',
      };

      await expect(service.createPeriod(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(evaluationPeriodRepositoryMock.create).not.toHaveBeenCalled();

      expect(evaluationPeriodRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um período com datas inicial e final iguais', async () => {
      const dto = {
        name: 'Período com Datas Iguais',
        startDate: '2027-03-01T00:00:00.000Z',
        endDate: '2027-03-01T00:00:00.000Z',
      };

      await expect(service.createPeriod(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(evaluationPeriodRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve listar os períodos do mais recente para o mais antigo', async () => {
      const periods = [
        {
          id: 'period-id-2',
          name: 'Avaliação 2027/2',
        },
        {
          id: 'period-id-1',
          name: 'Avaliação 2027/1',
        },
      ];

      evaluationPeriodRepositoryMock.find.mockResolvedValue(periods);

      const result = await service.findPeriods();

      expect(evaluationPeriodRepositoryMock.find).toHaveBeenCalledWith({
        order: {
          startDate: 'DESC',
        },
      });

      expect(result).toEqual(periods);
    });

    describe('Edição de períodos de avaliação', () => {
      function makePeriod() {
        return {
          id: 'period-id-1',
          name: 'Avaliação 2027/1',
          startDate: new Date('2027-03-01T00:00:00.000Z'),
          endDate: new Date('2027-03-31T23:59:59.000Z'),
          active: true,
        };
      }

      it('deve atualizar o nome do período mesmo com avaliações vinculadas', async () => {
        const period = makePeriod();

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue(period);
        evaluationPeriodRepositoryMock.save.mockImplementation(
          async (value) => value,
        );

        const result = await service.updatePeriod(period.id, {
          name: 'Avaliação de Disciplinas 2027/1',
        });

        expect(result.name).toBe('Avaliação de Disciplinas 2027/1');

        expect(evaluationRepositoryMock.count).not.toHaveBeenCalled();
        expect(evaluationPeriodRepositoryMock.save).toHaveBeenCalledTimes(1);
      });

      it('deve permitir alterar a data final quando não existem avaliações', async () => {
        const period = makePeriod();

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue(period);
        evaluationRepositoryMock.count.mockResolvedValue(0);
        evaluationPeriodRepositoryMock.save.mockImplementation(
          async (value) => value,
        );

        const result = await service.updatePeriod(period.id, {
          endDate: '2027-04-15T23:59:59.000Z',
        });

        expect(evaluationRepositoryMock.count).toHaveBeenCalledWith({
          where: {
            evaluationPeriod: { id: period.id },
          },
        });

        expect(result.endDate).toEqual(new Date('2027-04-15T23:59:59.000Z'));

        expect(evaluationPeriodRepositoryMock.save).toHaveBeenCalledTimes(1);
      });

      it('deve impedir alteração de datas quando existem avaliações', async () => {
        const period = makePeriod();

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue(period);
        evaluationRepositoryMock.count.mockResolvedValue(2);

        await expect(
          service.updatePeriod(period.id, {
            endDate: '2027-04-15T23:59:59.000Z',
          }),
        ).rejects.toThrow(ConflictException);

        expect(evaluationRepositoryMock.count).toHaveBeenCalledWith({
          where: {
            evaluationPeriod: { id: period.id },
          },
        });

        expect(evaluationPeriodRepositoryMock.save).not.toHaveBeenCalled();
      });

      it('deve rejeitar data final anterior à data inicial', async () => {
        const period = makePeriod();

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue(period);

        await expect(
          service.updatePeriod(period.id, {
            endDate: '2027-02-28T23:59:59.000Z',
          }),
        ).rejects.toThrow(BadRequestException);

        expect(evaluationPeriodRepositoryMock.save).not.toHaveBeenCalled();
      });

      it('deve rejeitar datas inválidas na edição', async () => {
        const period = makePeriod();

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue(period);

        await expect(
          service.updatePeriod(period.id, {
            startDate: 'data-invalida',
          }),
        ).rejects.toThrow(BadRequestException);

        expect(evaluationPeriodRepositoryMock.save).not.toHaveBeenCalled();
      });

      it('deve rejeitar edição de período inexistente', async () => {
        evaluationPeriodRepositoryMock.findOne.mockResolvedValue(null);

        await expect(
          service.updatePeriod('period-id-inexistente', {
            name: 'Novo nome',
          }),
        ).rejects.toThrow(NotFoundException);

        expect(evaluationPeriodRepositoryMock.save).not.toHaveBeenCalled();
      });

      it('deve rejeitar atualização sem campos', async () => {
        const period = makePeriod();

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue(period);

        await expect(service.updatePeriod(period.id, {})).rejects.toThrow(
          BadRequestException,
        );

        expect(evaluationPeriodRepositoryMock.save).not.toHaveBeenCalled();
      });

      it('deve permitir manter as mesmas datas sem consultar avaliações', async () => {
        const period = makePeriod();

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue(period);
        evaluationPeriodRepositoryMock.save.mockImplementation(
          async (value) => value,
        );

        const result = await service.updatePeriod(period.id, {
          name: 'Avaliação 2027/1 - Revisada',
          startDate: '2027-03-01T00:00:00.000Z',
          endDate: '2027-03-31T23:59:59.000Z',
        });

        expect(result.name).toBe('Avaliação 2027/1 - Revisada');

        expect(result.startDate).toEqual(new Date('2027-03-01T00:00:00.000Z'));

        expect(result.endDate).toEqual(new Date('2027-03-31T23:59:59.000Z'));

        expect(evaluationRepositoryMock.count).not.toHaveBeenCalled();
        expect(evaluationPeriodRepositoryMock.save).toHaveBeenCalledTimes(1);
      });
    });

    describe('Exclusão de períodos de avaliação', () => {
      it('deve excluir um período sem avaliações vinculadas', async () => {
        const periodId = 'period-id-1';

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue({
          id: periodId,
          name: 'Período de teste',
        });

        evaluationRepositoryMock.count.mockResolvedValue(0);

        evaluationPeriodRepositoryMock.delete.mockResolvedValue({
          affected: 1,
        });

        const result = await service.deletePeriod(periodId);

        expect(evaluationRepositoryMock.count).toHaveBeenCalledWith({
          where: {
            evaluationPeriod: { id: periodId },
          },
        });

        expect(evaluationPeriodRepositoryMock.delete).toHaveBeenCalledWith(
          periodId,
        );

        expect(result).toEqual({
          message: 'Período de avaliação excluído com sucesso.',
        });
      });

      it('deve impedir exclusão de período com avaliações vinculadas', async () => {
        const periodId = 'period-id-1';

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue({
          id: periodId,
          name: 'Avaliação 2027/1',
        });

        evaluationRepositoryMock.count.mockResolvedValue(2);

        await expect(service.deletePeriod(periodId)).rejects.toThrow(
          ConflictException,
        );

        expect(evaluationRepositoryMock.count).toHaveBeenCalledWith({
          where: {
            evaluationPeriod: { id: periodId },
          },
        });

        expect(evaluationPeriodRepositoryMock.delete).not.toHaveBeenCalled();
      });

      it('deve rejeitar exclusão de período inexistente', async () => {
        evaluationPeriodRepositoryMock.findOne.mockResolvedValue(null);

        await expect(
          service.deletePeriod('period-id-inexistente'),
        ).rejects.toThrow(NotFoundException);

        expect(evaluationRepositoryMock.count).not.toHaveBeenCalled();
        expect(evaluationPeriodRepositoryMock.delete).not.toHaveBeenCalled();
      });

      it('deve tratar exclusão sem registro afetado', async () => {
        const periodId = 'period-id-1';

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue({
          id: periodId,
          name: 'Avaliação 2027/1',
        });

        evaluationRepositoryMock.count.mockResolvedValue(0);

        evaluationPeriodRepositoryMock.delete.mockResolvedValue({
          affected: 0,
        });

        await expect(service.deletePeriod(periodId)).rejects.toThrow(
          NotFoundException,
        );

        expect(evaluationPeriodRepositoryMock.delete).toHaveBeenCalledWith(
          periodId,
        );
      });

      it('deve tratar erro de chave estrangeira ao excluir período', async () => {
        const periodId = 'period-id-1';

        evaluationPeriodRepositoryMock.findOne.mockResolvedValue({
          id: periodId,
          name: 'Avaliação 2027/1',
        });

        evaluationRepositoryMock.count.mockResolvedValue(0);

        evaluationPeriodRepositoryMock.delete.mockRejectedValue(
          new QueryFailedError(
            'DELETE FROM evaluation_periods WHERE id = $1',
            [periodId],
            Object.assign(new Error('Violação de chave estrangeira'), {
              code: '23503',
            }),
          ),
        );

        await expect(service.deletePeriod(periodId)).rejects.toThrow(
          ConflictException,
        );

        expect(evaluationPeriodRepositoryMock.delete).toHaveBeenCalledWith(
          periodId,
        );
      });
    });
  });

  describe('Criação de avaliações', () => {
    const dto = {
      evaluationPeriodId: 'period-id-1',
      classGroupId: 'class-group-id-1',
      questionnaireId: 'questionnaire-id-1',
      minResponsesForResults: 3,
    };

    const period = {
      id: dto.evaluationPeriodId,
      active: true,
    };

    const classGroup = {
      id: dto.classGroupId,
      code: 'TURMA-01',
    };

    const questionnaire = {
      id: dto.questionnaireId,
      name: 'Avaliação Geral',
      active: true,
    };

    beforeEach(() => {
      evaluationPeriodRepositoryMock.findOne.mockResolvedValue(period);

      classGroupRepositoryMock.findOne.mockResolvedValue(classGroup);

      questionnaireRepositoryMock.findOne.mockResolvedValue(questionnaire);

      evaluationRepositoryMock.findOne.mockResolvedValue(null);
    });

    it('deve cadastrar uma avaliação válida', async () => {
      const evaluation = {
        evaluationPeriod: period,
        classGroup,
        questionnaire,
        minResponsesForResults: 3,
      };

      const savedEvaluation = {
        id: 'evaluation-id-1',
        ...evaluation,
      };

      evaluationRepositoryMock.create.mockReturnValue(evaluation);

      evaluationRepositoryMock.save.mockResolvedValue(savedEvaluation);

      const result = await service.createEvaluation(dto);

      expect(evaluationPeriodRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dto.evaluationPeriodId },
      });

      expect(classGroupRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dto.classGroupId },
      });

      expect(questionnaireRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dto.questionnaireId },
      });

      expect(evaluationRepositoryMock.findOne).toHaveBeenCalledWith({
        where: {
          evaluationPeriod: {
            id: dto.evaluationPeriodId,
          },
          classGroup: {
            id: dto.classGroupId,
          },
        },
      });

      expect(evaluationRepositoryMock.create).toHaveBeenCalledWith(evaluation);

      expect(evaluationRepositoryMock.save).toHaveBeenCalledWith(evaluation);

      expect(result).toEqual(savedEvaluation);
    });

    it('deve rejeitar uma avaliação com período inexistente', async () => {
      evaluationPeriodRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createEvaluation(dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(evaluationRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma avaliação com período inativo', async () => {
      evaluationPeriodRepositoryMock.findOne.mockResolvedValue({
        ...period,
        active: false,
      });

      await expect(service.createEvaluation(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(evaluationRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma avaliação com turma inexistente', async () => {
      classGroupRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createEvaluation(dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(evaluationRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma avaliação com questionário inexistente', async () => {
      questionnaireRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createEvaluation(dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(evaluationRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma avaliação com questionário inativo', async () => {
      questionnaireRepositoryMock.findOne.mockResolvedValue({
        ...questionnaire,
        active: false,
      });

      await expect(service.createEvaluation(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(evaluationRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve impedir avaliações duplicadas na mesma turma e período', async () => {
      evaluationRepositoryMock.findOne.mockResolvedValue({
        id: 'existing-evaluation-id',
      });

      await expect(service.createEvaluation(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(evaluationRepositoryMock.create).not.toHaveBeenCalled();

      expect(evaluationRepositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('Elegibilidade dos estudantes', () => {
    const dto = {
      evaluationId: 'evaluation-id-1',
      studentId: 'student-id-1',
    };

    const evaluation = {
      id: dto.evaluationId,
    };

    const student = {
      id: dto.studentId,
      name: 'Estudante de Teste',
      role: UserRole.STUDENT,
      active: true,
    };

    beforeEach(() => {
      evaluationRepositoryMock.findOne.mockResolvedValue(evaluation);

      userRepositoryMock.findOne.mockResolvedValue(student);

      evaluationEligibilityRepositoryMock.findOne.mockResolvedValue(null);
    });

    it('deve habilitar um estudante ativo para uma avaliação', async () => {
      const eligibility = {
        evaluation,
        student,
        completed: false,
      };

      const savedEligibility = {
        id: 'eligibility-id-1',
        ...eligibility,
      };

      evaluationEligibilityRepositoryMock.create.mockReturnValue(eligibility);

      evaluationEligibilityRepositoryMock.save.mockResolvedValue(
        savedEligibility,
      );

      const result = await service.createEligibility(dto);

      expect(evaluationRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dto.evaluationId },
      });

      expect(userRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dto.studentId },
      });

      expect(evaluationEligibilityRepositoryMock.findOne).toHaveBeenCalledWith({
        where: {
          evaluation: { id: dto.evaluationId },
          student: { id: dto.studentId },
        },
      });

      expect(evaluationEligibilityRepositoryMock.create).toHaveBeenCalledWith({
        evaluation,
        student,
        completed: false,
      });

      expect(evaluationEligibilityRepositoryMock.save).toHaveBeenCalledWith(
        eligibility,
      );

      expect(result).toEqual(savedEligibility);
    });

    it('deve rejeitar elegibilidade para uma avaliação inexistente', async () => {
      evaluationRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createEligibility(dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(evaluationEligibilityRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar elegibilidade para um estudante inexistente', async () => {
      userRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.createEligibility(dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(evaluationEligibilityRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um usuário que não possui perfil de estudante', async () => {
      userRepositoryMock.findOne.mockResolvedValue({
        ...student,
        role: UserRole.PROFESSOR,
      });

      await expect(service.createEligibility(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(evaluationEligibilityRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um estudante inativo', async () => {
      userRepositoryMock.findOne.mockResolvedValue({
        ...student,
        active: false,
      });

      await expect(service.createEligibility(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(evaluationEligibilityRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve impedir elegibilidade duplicada para a mesma avaliação', async () => {
      evaluationEligibilityRepositoryMock.findOne.mockResolvedValue({
        id: 'existing-eligibility-id',
        evaluation,
        student,
        completed: false,
      });

      await expect(service.createEligibility(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(evaluationEligibilityRepositoryMock.create).not.toHaveBeenCalled();

      expect(evaluationEligibilityRepositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('Consulta de elegibilidades', () => {
    const evaluationId = 'evaluation-id-1';

    beforeEach(() => {
      evaluationRepositoryMock.findOne.mockResolvedValue({
        id: evaluationId,
      });
    });

    it('deve listar as elegibilidades sem expor dados desnecessários dos estudantes', async () => {
      const createdAt = new Date('2027-03-01T10:00:00.000Z');

      const eligibilities = [
        {
          id: 'eligibility-id-1',
          completed: false,
          createdAt,
          student: {
            id: 'student-id-1',
            name: 'Estudante de Teste',
            email: 'estudante@exemplo.com',
            passwordHash: 'senha-hash-simulada',
          },
        },
      ];

      evaluationEligibilityRepositoryMock.find.mockResolvedValue(eligibilities);

      const result = await service.findEligibilities(evaluationId);

      expect(evaluationRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: evaluationId },
      });

      expect(evaluationEligibilityRepositoryMock.find).toHaveBeenCalledWith({
        where: {
          evaluation: {
            id: evaluationId,
          },
        },
        relations: {
          student: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      expect(result).toEqual([
        {
          id: 'eligibility-id-1',
          completed: false,
          createdAt,
          student: {
            id: 'student-id-1',
            name: 'Estudante de Teste',
          },
        },
      ]);

      expect(result[0].student).not.toHaveProperty('email');

      expect(result[0].student).not.toHaveProperty('passwordHash');
    });

    it('deve retornar uma lista vazia quando não houver estudantes habilitados', async () => {
      evaluationEligibilityRepositoryMock.find.mockResolvedValue([]);

      const result = await service.findEligibilities(evaluationId);

      expect(result).toEqual([]);
    });

    it('deve rejeitar a consulta de elegibilidades de uma avaliação inexistente', async () => {
      evaluationRepositoryMock.findOne.mockResolvedValue(null);

      await expect(service.findEligibilities(evaluationId)).rejects.toThrow(
        NotFoundException,
      );

      expect(evaluationEligibilityRepositoryMock.find).not.toHaveBeenCalled();
    });
  });

  describe('Avaliações do estudante', () => {
    const studentId = 'student-id-1';

    it('deve consultar somente as avaliações vinculadas ao estudante', async () => {
      const eligibilities = [
        {
          id: 'eligibility-id-1',
          completed: false,
          evaluation: {
            id: 'evaluation-id-1',
            evaluationPeriod: {
              name: 'Avaliação 2027/1',
            },
            classGroup: {
              code: 'TURMA-01',
              discipline: {
                name: 'Programação',
                course: {
                  name: 'Ciência da Computação',
                },
              },
              professor: {
                name: 'Professor de Teste',
              },
              academicTerm: {
                code: '2027/1',
              },
            },
            questionnaire: {
              name: 'Avaliação Geral',
            },
          },
        },
      ];

      evaluationEligibilityRepositoryMock.find.mockResolvedValue(eligibilities);

      const result = await service.findMyEvaluations(studentId);

      expect(evaluationEligibilityRepositoryMock.find).toHaveBeenCalledWith({
        where: {
          student: {
            id: studentId,
          },
        },
        relations: {
          evaluation: {
            evaluationPeriod: true,
            classGroup: {
              discipline: {
                course: true,
              },
              professor: true,
              academicTerm: true,
            },
            questionnaire: true,
          },
        },
        order: {
          createdAt: 'DESC',
        },
      });

      expect(result).toEqual(eligibilities);

      expect(evaluationEligibilityRepositoryMock.find).toHaveBeenCalledTimes(1);
    });

    it('deve retornar uma lista vazia quando o estudante não possuir avaliações', async () => {
      evaluationEligibilityRepositoryMock.find.mockResolvedValue([]);

      const result = await service.findMyEvaluations(studentId);

      expect(result).toEqual([]);

      expect(evaluationEligibilityRepositoryMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            student: {
              id: studentId,
            },
          },
        }),
      );
    });
  });

  describe('Acesso do estudante ao questionário', () => {
    const evaluationId = 'evaluation-id-1';
    const studentId = 'student-id-1';

    const createEligibilityFixture = () => ({
      id: 'eligibility-id-1',
      completed: false,
      evaluation: {
        id: evaluationId,
        evaluationPeriod: {
          active: true,
          startDate: new Date(Date.now() - 86400000),
          endDate: new Date(Date.now() + 86400000),
        },
        questionnaire: {
          id: 'questionnaire-id-1',
          name: 'Avaliação Geral',
          active: true,
          dimensions: [
            {
              id: 'dimension-id-2',
              name: 'Metodologia',
              order: 2,
              questions: [
                {
                  id: 'question-id-3',
                  order: 2,
                },
                {
                  id: 'question-id-2',
                  order: 1,
                },
              ],
            },
            {
              id: 'dimension-id-1',
              name: 'Organização',
              order: 1,
              questions: [
                {
                  id: 'question-id-1',
                  order: 1,
                },
              ],
            },
          ],
        },
      },
    });

    beforeEach(() => {
      evaluationEligibilityRepositoryMock.findOne.mockResolvedValue(
        createEligibilityFixture(),
      );
    });

    it('deve permitir o acesso e ordenar dimensões e perguntas', async () => {
      const result = await service.findQuestionnaireForStudent(
        evaluationId,
        studentId,
      );

      expect(evaluationEligibilityRepositoryMock.findOne).toHaveBeenCalledWith({
        where: {
          student: { id: studentId },
          evaluation: { id: evaluationId },
        },
        relations: {
          evaluation: {
            evaluationPeriod: true,
            questionnaire: {
              dimensions: {
                questions: true,
              },
            },
          },
        },
      });

      expect(result.evaluationId).toBe(evaluationId);

      expect(
        result.questionnaire.dimensions.map((dimension) => dimension.order),
      ).toEqual([1, 2]);

      expect(
        result.questionnaire.dimensions[1].questions.map(
          (question) => question.order,
        ),
      ).toEqual([1, 2]);
    });

    it('deve impedir o acesso de um estudante não habilitado', async () => {
      evaluationEligibilityRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.findQuestionnaireForStudent(evaluationId, studentId),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve impedir o acesso quando a avaliação já foi respondida', async () => {
      const eligibility = createEligibilityFixture();
      eligibility.completed = true;

      evaluationEligibilityRepositoryMock.findOne.mockResolvedValue(
        eligibility,
      );

      await expect(
        service.findQuestionnaireForStudent(evaluationId, studentId),
      ).rejects.toThrow('Você já respondeu esta avaliação.');
    });

    it('deve bloquear o acesso quando o período estiver inativo', async () => {
      const eligibility = createEligibilityFixture();
      eligibility.evaluation.evaluationPeriod.active = false;

      evaluationEligibilityRepositoryMock.findOne.mockResolvedValue(
        eligibility,
      );

      await expect(
        service.findQuestionnaireForStudent(evaluationId, studentId),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve bloquear o acesso antes do início do período', async () => {
      const eligibility = createEligibilityFixture();

      eligibility.evaluation.evaluationPeriod.startDate = new Date(
        Date.now() + 86400000,
      );

      eligibility.evaluation.evaluationPeriod.endDate = new Date(
        Date.now() + 172800000,
      );

      evaluationEligibilityRepositoryMock.findOne.mockResolvedValue(
        eligibility,
      );

      await expect(
        service.findQuestionnaireForStudent(evaluationId, studentId),
      ).rejects.toThrow('Esta avaliação não está disponível para resposta.');
    });

    it('deve bloquear o acesso após o encerramento do período', async () => {
      const eligibility = createEligibilityFixture();

      eligibility.evaluation.evaluationPeriod.startDate = new Date(
        Date.now() - 172800000,
      );

      eligibility.evaluation.evaluationPeriod.endDate = new Date(
        Date.now() - 86400000,
      );

      evaluationEligibilityRepositoryMock.findOne.mockResolvedValue(
        eligibility,
      );

      await expect(
        service.findQuestionnaireForStudent(evaluationId, studentId),
      ).rejects.toThrow('Esta avaliação não está disponível para resposta.');
    });

    it('deve impedir o acesso quando o questionário estiver inativo', async () => {
      const eligibility = createEligibilityFixture();
      eligibility.evaluation.questionnaire.active = false;

      evaluationEligibilityRepositoryMock.findOne.mockResolvedValue(
        eligibility,
      );

      await expect(
        service.findQuestionnaireForStudent(evaluationId, studentId),
      ).rejects.toThrow('O questionário desta avaliação não está disponível.');
    });
  });

  describe('Envio das avaliações', () => {
    const evaluationId = 'evaluation-id-1';
    const studentId = 'student-id-1';

    const transactionEligibilityRepositoryMock = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const transactionEvaluationRepositoryMock = {
      findOne: jest.fn(),
    };

    const transactionSubmissionRepositoryMock = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const transactionAnswerRepositoryMock = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const managerMock = {
      getRepository: jest.fn(),
    };

    const createEvaluationFixture = () => ({
      id: evaluationId,
      evaluationPeriod: {
        active: true,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
      },
      questionnaire: {
        active: true,
        dimensions: [
          {
            id: 'dimension-id-1',
            questions: [
              {
                id: 'question-scale',
                text: 'Avalie a organização da disciplina.',
                type: QuestionType.SCALE,
                required: true,
                scaleMin: 1,
                scaleMax: 5,
              },
              {
                id: 'question-choice',
                text: 'Como você avalia a metodologia?',
                type: QuestionType.SINGLE_CHOICE,
                required: true,
                options: ['Ruim', 'Regular', 'Boa'],
              },
              {
                id: 'question-text',
                text: 'Deixe um comentário.',
                type: QuestionType.TEXT,
                required: false,
              },
            ],
          },
        ],
      },
    });

    beforeEach(() => {
      managerMock.getRepository.mockImplementation((entity: unknown) => {
        if (entity === EvaluationEligibility) {
          return transactionEligibilityRepositoryMock;
        }

        if (entity === Evaluation) {
          return transactionEvaluationRepositoryMock;
        }

        if (entity === Submission) {
          return transactionSubmissionRepositoryMock;
        }

        if (entity === Answer) {
          return transactionAnswerRepositoryMock;
        }

        throw new Error('Repositório não configurado no teste.');
      });

      dataSourceMock.transaction.mockImplementation(
        async (callback: (manager: typeof managerMock) => Promise<unknown>) =>
          callback(managerMock),
      );

      transactionEligibilityRepositoryMock.findOne.mockResolvedValue({
        id: 'eligibility-id-1',
        completed: false,
      });

      transactionEvaluationRepositoryMock.findOne.mockResolvedValue(
        createEvaluationFixture(),
      );

      transactionSubmissionRepositoryMock.create.mockImplementation(
        (data: unknown) => data,
      );

      transactionSubmissionRepositoryMock.save.mockResolvedValue({
        id: 'submission-id-1',
        submittedAt: new Date('2027-03-15T10:00:00.000Z'),
      });

      transactionAnswerRepositoryMock.create.mockImplementation(
        (data: unknown) => data,
      );

      transactionAnswerRepositoryMock.save.mockResolvedValue([]);
    });

    it('deve impedir o envio por um estudante não habilitado', async () => {
      transactionEligibilityRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.submitEvaluation(evaluationId, studentId, {
          answers: [],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(transactionEligibilityRepositoryMock.findOne).toHaveBeenCalledWith(
        {
          where: {
            evaluation: {
              id: evaluationId,
            },
            student: {
              id: studentId,
            },
          },
          lock: {
            mode: 'pessimistic_write',
          },
        },
      );

      expect(transactionSubmissionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve impedir que o estudante responda novamente', async () => {
      transactionEligibilityRepositoryMock.findOne.mockResolvedValue({
        id: 'eligibility-id-1',
        completed: true,
      });

      await expect(
        service.submitEvaluation(evaluationId, studentId, {
          answers: [],
        }),
      ).rejects.toThrow('Esta avaliação já foi respondida.');

      expect(transactionSubmissionRepositoryMock.create).not.toHaveBeenCalled();

      expect(transactionSubmissionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve registrar as respostas sem vincular diretamente o estudante à submissão', async () => {
      const dto = {
        answers: [
          {
            questionId: 'question-scale',
            scaleValue: 4,
          },
          {
            questionId: 'question-choice',
            choiceValue: 'Boa',
          },
          {
            questionId: 'question-text',
            textValue: 'Material interessante.',
          },
        ],
      };

      const result = await service.submitEvaluation(
        evaluationId,
        studentId,
        dto,
      );

      expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);

      expect(managerMock.getRepository).toHaveBeenCalledWith(
        EvaluationEligibility,
      );

      expect(managerMock.getRepository).toHaveBeenCalledWith(Evaluation);

      expect(managerMock.getRepository).toHaveBeenCalledWith(Submission);

      expect(managerMock.getRepository).toHaveBeenCalledWith(Answer);

      expect(transactionEligibilityRepositoryMock.findOne).toHaveBeenCalledWith(
        {
          where: {
            evaluation: {
              id: evaluationId,
            },
            student: {
              id: studentId,
            },
          },
          lock: {
            mode: 'pessimistic_write',
          },
        },
      );

      expect(transactionSubmissionRepositoryMock.create).toHaveBeenCalledWith({
        evaluation: expect.objectContaining({
          id: evaluationId,
        }),
      });

      const submissionData =
        transactionSubmissionRepositoryMock.create.mock.calls[0][0];

      expect(submissionData).not.toHaveProperty('studentId');
      expect(submissionData).not.toHaveProperty('student');

      expect(transactionSubmissionRepositoryMock.save).toHaveBeenCalledTimes(1);

      expect(transactionAnswerRepositoryMock.create).toHaveBeenCalledTimes(3);

      expect(transactionAnswerRepositoryMock.save).toHaveBeenCalledTimes(1);

      expect(transactionEligibilityRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'eligibility-id-1',
          completed: true,
        }),
      );

      expect(result).toEqual({
        submissionId: 'submission-id-1',
        evaluationId,
        submittedAt: new Date('2027-03-15T10:00:00.000Z'),
        answersCount: 3,
      });
    });

    it('deve rejeitar perguntas duplicadas na mesma submissão', async () => {
      const dto = {
        answers: [
          {
            questionId: 'question-scale',
            scaleValue: 4,
          },
          {
            questionId: 'question-scale',
            scaleValue: 5,
          },
          {
            questionId: 'question-choice',
            choiceValue: 'Boa',
          },
        ],
      };

      await expect(
        service.submitEvaluation(evaluationId, studentId, dto),
      ).rejects.toThrow('Existem perguntas duplicadas na submissão.');

      expect(transactionSubmissionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma pergunta que não pertence ao questionário', async () => {
      const dto = {
        answers: [
          {
            questionId: 'question-inexistente',
            scaleValue: 4,
          },
          {
            questionId: 'question-scale',
            scaleValue: 4,
          },
          {
            questionId: 'question-choice',
            choiceValue: 'Boa',
          },
        ],
      };

      await expect(
        service.submitEvaluation(evaluationId, studentId, dto),
      ).rejects.toThrow(
        'Uma das perguntas informadas não pertence ao questionário desta avaliação.',
      );

      expect(transactionSubmissionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma submissão sem todas as perguntas obrigatórias', async () => {
      const dto = {
        answers: [
          {
            questionId: 'question-scale',
            scaleValue: 4,
          },
        ],
      };

      await expect(
        service.submitEvaluation(evaluationId, studentId, dto),
      ).rejects.toThrow(
        'A pergunta obrigatória "Como você avalia a metodologia?" não foi respondida.',
      );

      expect(transactionSubmissionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar um valor SCALE fora dos limites permitidos', async () => {
      const dto = {
        answers: [
          {
            questionId: 'question-scale',
            scaleValue: 8,
          },
          {
            questionId: 'question-choice',
            choiceValue: 'Boa',
          },
        ],
      };

      await expect(
        service.submitEvaluation(evaluationId, studentId, dto),
      ).rejects.toThrow(
        'O valor da pergunta "Avalie a organização da disciplina." deve estar entre 1 e 5.',
      );

      expect(transactionSubmissionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma alternativa SINGLE_CHOICE inválida', async () => {
      const dto = {
        answers: [
          {
            questionId: 'question-scale',
            scaleValue: 4,
          },
          {
            questionId: 'question-choice',
            choiceValue: 'Excelente',
          },
        ],
      };

      await expect(
        service.submitEvaluation(evaluationId, studentId, dto),
      ).rejects.toThrow(
        'A opção informada para a pergunta "Como você avalia a metodologia?" é inválida.',
      );

      expect(transactionSubmissionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma resposta TEXT contendo apenas espaços', async () => {
      const dto = {
        answers: [
          {
            questionId: 'question-scale',
            scaleValue: 4,
          },
          {
            questionId: 'question-choice',
            choiceValue: 'Boa',
          },
          {
            questionId: 'question-text',
            textValue: '   ',
          },
        ],
      };

      await expect(
        service.submitEvaluation(evaluationId, studentId, dto),
      ).rejects.toThrow(
        'A resposta da pergunta "Deixe um comentário." não pode estar vazia.',
      );

      expect(transactionSubmissionRepositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('Divulgação dos resultados', () => {
    const evaluationId = 'evaluation-id-1';

    const adminRequester = {
      userId: 'admin-id-1',
      role: UserRole.ADMIN,
    };

    const resultsEligibilityRepositoryMock = {
      count: jest.fn(),
    };

    const resultsSubmissionRepositoryMock = {
      count: jest.fn(),
    };

    const resultsAnswerRepositoryMock = {
      find: jest.fn(),
    };

    const createResultsEvaluationFixture = () => ({
      id: evaluationId,
      evaluationPeriod: {
        endDate: new Date('2026-01-01T00:00:00.000Z'),
      },
      classGroup: {
        code: 'TURMA-01',
        professor: {
          id: 'professor-id-1',
          name: 'Professor de Teste',
        },
        discipline: {
          code: 'DISC-01',
          name: 'Programação',
        },
        academicTerm: {
          code: '2026/1',
        },
      },
      questionnaire: {
        dimensions: [],
      },
      minResponsesForResults: 3,
    });

    beforeEach(() => {
      evaluationRepositoryMock.findOne.mockResolvedValue(
        createResultsEvaluationFixture(),
      );

      resultsEligibilityRepositoryMock.count.mockResolvedValue(10);

      resultsSubmissionRepositoryMock.count.mockResolvedValue(5);

      resultsAnswerRepositoryMock.find.mockResolvedValue([]);

      dataSourceMock.getRepository.mockImplementation((entity: unknown) => {
        if (entity === EvaluationEligibility) {
          return resultsEligibilityRepositoryMock;
        }

        if (entity === Submission) {
          return resultsSubmissionRepositoryMock;
        }

        if (entity === Answer) {
          return resultsAnswerRepositoryMock;
        }

        throw new Error('Repositório não configurado no teste.');
      });
    });

    it('deve rejeitar a consulta de uma avaliação inexistente', async () => {
      evaluationRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.getResults(evaluationId, adminRequester),
      ).rejects.toThrow(NotFoundException);

      expect(dataSourceMock.getRepository).not.toHaveBeenCalled();
    });

    it('deve impedir que um professor consulte resultados de outra turma', async () => {
      const requester = {
        userId: 'professor-id-2',
        role: UserRole.PROFESSOR,
      };

      await expect(service.getResults(evaluationId, requester)).rejects.toThrow(
        'Você não possui acesso aos resultados desta avaliação.',
      );

      expect(dataSourceMock.getRepository).not.toHaveBeenCalled();
    });

    it('deve impedir que um estudante consulte os resultados', async () => {
      const requester = {
        userId: 'student-id-1',
        role: UserRole.STUDENT,
      };

      await expect(service.getResults(evaluationId, requester)).rejects.toThrow(
        ForbiddenException,
      );

      expect(dataSourceMock.getRepository).not.toHaveBeenCalled();
    });

    it('deve impedir a divulgação antes do encerramento do período', async () => {
      const evaluation = createResultsEvaluationFixture();

      evaluation.evaluationPeriod.endDate = new Date(
        '2099-12-31T23:59:59.000Z',
      );

      evaluationRepositoryMock.findOne.mockResolvedValue(evaluation);

      await expect(
        service.getResults(evaluationId, adminRequester),
      ).rejects.toThrow(
        'Os resultados estarão disponíveis somente após o encerramento do período de avaliação.',
      );

      expect(dataSourceMock.getRepository).not.toHaveBeenCalled();
    });

    it('deve impedir a divulgação quando o mínimo de respostas não estiver configurado', async () => {
      const evaluation = {
        ...createResultsEvaluationFixture(),
        minResponsesForResults: null,
      };

      evaluationRepositoryMock.findOne.mockResolvedValue(evaluation);

      await expect(
        service.getResults(evaluationId, adminRequester),
      ).rejects.toThrow(
        'A quantidade mínima de respostas para divulgação dos resultados ainda não foi configurada.',
      );

      expect(dataSourceMock.getRepository).not.toHaveBeenCalled();
    });

    it('deve impedir a divulgação quando o mínimo de respostas não for atingido', async () => {
      resultsEligibilityRepositoryMock.count.mockResolvedValue(10);

      resultsSubmissionRepositoryMock.count.mockResolvedValue(2);

      await expect(
        service.getResults(evaluationId, adminRequester),
      ).rejects.toThrow(
        'Os resultados ainda não podem ser divulgados. São necessárias pelo menos 3 respostas.',
      );

      expect(resultsEligibilityRepositoryMock.count).toHaveBeenCalledWith({
        where: {
          evaluation: {
            id: evaluationId,
          },
        },
      });

      expect(resultsSubmissionRepositoryMock.count).toHaveBeenCalledWith({
        where: {
          evaluation: {
            id: evaluationId,
          },
        },
      });

      expect(resultsAnswerRepositoryMock.find).not.toHaveBeenCalled();
    });

    it('deve calcular corretamente as estatísticas e a participação', async () => {
      const evaluation = {
        ...createResultsEvaluationFixture(),
        questionnaire: {
          dimensions: [
            {
              id: 'dimension-2',
              name: 'Metodologia',
              order: 2,
              questions: [
                {
                  id: 'question-choice',
                  text: 'Como foi a metodologia?',
                  type: QuestionType.SINGLE_CHOICE,
                  order: 2,
                  options: ['Boa', 'Regular', 'Ruim'],
                },
                {
                  id: 'question-text',
                  text: 'Deixe um comentário.',
                  type: QuestionType.TEXT,
                  order: 1,
                },
              ],
            },
            {
              id: 'dimension-1',
              name: 'Organização',
              order: 1,
              questions: [
                {
                  id: 'question-scale',
                  text: 'Avalie a organização.',
                  type: QuestionType.SCALE,
                  order: 1,
                  scaleMin: 1,
                  scaleMax: 5,
                },
              ],
            },
          ],
        },
      };

      evaluationRepositoryMock.findOne.mockResolvedValue(evaluation);

      resultsEligibilityRepositoryMock.count.mockResolvedValue(10);

      resultsSubmissionRepositoryMock.count.mockResolvedValue(5);

      resultsAnswerRepositoryMock.find.mockResolvedValue([
        {
          question: { id: 'question-scale' },
          scaleValue: 2,
          choiceValue: null,
          textValue: null,
        },
        {
          question: { id: 'question-scale' },
          scaleValue: 4,
          choiceValue: null,
          textValue: null,
        },
        {
          question: { id: 'question-scale' },
          scaleValue: 5,
          choiceValue: null,
          textValue: null,
        },
        {
          question: { id: 'question-choice' },
          scaleValue: null,
          choiceValue: 'Boa',
          textValue: null,
        },
        {
          question: { id: 'question-choice' },
          scaleValue: null,
          choiceValue: 'Boa',
          textValue: null,
        },
        {
          question: { id: 'question-choice' },
          scaleValue: null,
          choiceValue: 'Regular',
          textValue: null,
        },
        {
          question: { id: 'question-text' },
          scaleValue: null,
          choiceValue: null,
          textValue: 'Ótimas aulas.',
        },
        {
          question: { id: 'question-text' },
          scaleValue: null,
          choiceValue: null,
          textValue: '   ',
        },
        {
          question: { id: 'question-text' },
          scaleValue: null,
          choiceValue: null,
          textValue: 'Mais exemplos práticos.',
        },
      ]);

      const result = await service.getResults(evaluationId, adminRequester);

      expect(result.participation).toEqual({
        eligible: 10,
        responses: 5,
        rate: 50,
      });

      expect(result.minResponsesForResults).toBe(3);

      expect(result.dimensions.map((dimension) => dimension.order)).toEqual([
        1, 2,
      ]);

      expect(result.dimensions[0].questions[0]).toEqual({
        id: 'question-scale',
        text: 'Avalie a organização.',
        type: QuestionType.SCALE,
        responses: 3,
        average: 3.67,
        distribution: {
          '1': 0,
          '2': 1,
          '3': 0,
          '4': 1,
          '5': 1,
        },
      });

      expect(
        result.dimensions[1].questions.map((question) => question.id),
      ).toEqual(['question-text', 'question-choice']);

      expect(result.dimensions[1].questions[0]).toEqual({
        id: 'question-text',
        text: 'Deixe um comentário.',
        type: QuestionType.TEXT,
        responses: 2,
        comments: ['Ótimas aulas.', 'Mais exemplos práticos.'],
      });

      expect(result.dimensions[1].questions[1]).toEqual({
        id: 'question-choice',
        text: 'Como foi a metodologia?',
        type: QuestionType.SINGLE_CHOICE,
        responses: 3,
        distribution: {
          Boa: 2,
          Regular: 1,
          Ruim: 0,
        },
      });

      expect(resultsAnswerRepositoryMock.find).toHaveBeenCalledWith({
        where: {
          submission: {
            evaluation: {
              id: evaluationId,
            },
          },
        },
        relations: {
          question: true,
        },
      });
    });

    it('deve permitir que o professor responsável consulte os resultados', async () => {
      const requester = {
        userId: 'professor-id-1',
        role: UserRole.PROFESSOR,
      };

      const result = await service.getResults(evaluationId, requester);

      expect(result.evaluation.id).toBe(evaluationId);

      expect(result.evaluation.professor).toEqual({
        name: 'Professor de Teste',
      });

      expect(result.participation).toEqual({
        eligible: 10,
        responses: 5,
        rate: 50,
      });

      expect(resultsAnswerRepositoryMock.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('Consultas e configurações das avaliações', () => {
    it('deve listar todas as avaliações com seus relacionamentos', async () => {
      const evaluations = [
        {
          id: 'evaluation-id-2',
          minResponsesForResults: 3,
        },
        {
          id: 'evaluation-id-1',
          minResponsesForResults: 5,
        },
      ];

      evaluationRepositoryMock.find.mockResolvedValue(evaluations);

      const result = await service.findEvaluations();

      expect(evaluationRepositoryMock.find).toHaveBeenCalledWith({
        relations: {
          evaluationPeriod: true,
          classGroup: {
            discipline: {
              course: true,
            },
            professor: true,
            academicTerm: true,
          },
          questionnaire: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      expect(result).toEqual(evaluations);
    });

    it('deve consultar apenas as avaliações vinculadas ao professor informado', async () => {
      const professorId = 'professor-id-1';

      const evaluations = [
        {
          id: 'evaluation-id-1',
          classGroup: {
            professor: {
              id: professorId,
              name: 'Professor de Teste',
            },
          },
        },
      ];

      evaluationRepositoryMock.find.mockResolvedValue(evaluations);

      const result = await service.findProfessorEvaluations(professorId);

      expect(evaluationRepositoryMock.find).toHaveBeenCalledWith({
        where: {
          classGroup: {
            professor: {
              id: professorId,
            },
          },
        },
        relations: {
          evaluationPeriod: true,
          classGroup: {
            discipline: {
              course: true,
            },
            professor: true,
            academicTerm: true,
          },
          questionnaire: true,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      expect(result).toEqual(evaluations);
    });

    it('deve retornar uma lista vazia quando o professor não possuir avaliações', async () => {
      const professorId = 'professor-id-2';

      evaluationRepositoryMock.find.mockResolvedValue([]);

      const result = await service.findProfessorEvaluations(professorId);

      expect(result).toEqual([]);

      expect(evaluationRepositoryMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            classGroup: {
              professor: {
                id: professorId,
              },
            },
          },
        }),
      );
    });

    it('deve atualizar a quantidade mínima de respostas de uma avaliação', async () => {
      const evaluationId = 'evaluation-id-1';

      const dto = {
        minResponsesForResults: 5,
      };

      const evaluation = {
        id: evaluationId,
        minResponsesForResults: 3,
      };

      const updatedEvaluation = {
        id: evaluationId,
        minResponsesForResults: 5,
      };

      evaluationRepositoryMock.findOne.mockResolvedValue(evaluation);

      evaluationRepositoryMock.save.mockResolvedValue(updatedEvaluation);

      const result = await service.updateEvaluationSettings(evaluationId, dto);

      expect(evaluationRepositoryMock.findOne).toHaveBeenCalledWith({
        where: {
          id: evaluationId,
        },
      });

      expect(evaluationRepositoryMock.save).toHaveBeenCalledWith({
        id: evaluationId,
        minResponsesForResults: 5,
      });

      expect(result).toEqual(updatedEvaluation);
    });

    it('deve rejeitar a atualização de uma avaliação inexistente', async () => {
      const evaluationId = 'invalid-evaluation-id';

      const dto = {
        minResponsesForResults: 5,
      };

      evaluationRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateEvaluationSettings(evaluationId, dto),
      ).rejects.toThrow(NotFoundException);

      expect(evaluationRepositoryMock.save).not.toHaveBeenCalled();
    });
  });
});
