import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { QuestionnairesController } from './questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';
import { QuestionType } from './entities/question.entity';

describe('QuestionnairesController', () => {
  let controller: QuestionnairesController;

  const questionnairesServiceMock = {
    createQuestionnaire: jest.fn(),
    findQuestionnaires: jest.fn(),
    findQuestionnaire: jest.fn(),
    createDimension: jest.fn(),
    createQuestion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionnairesController],
      providers: [
        {
          provide: QuestionnairesService,
          useValue: questionnairesServiceMock,
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

    controller = module.get<QuestionnairesController>(QuestionnairesController);
  });

  it('deve criar o controller de questionários corretamente', () => {
    expect(controller).toBeDefined();
  });

  describe('Questionários', () => {
    it('deve encaminhar o cadastro de um questionário', async () => {
      const dto = {
        name: 'Avaliação Geral de Disciplinas',
        description: 'Questionário para avaliar disciplinas.',
      };

      const questionnaire = {
        id: 'questionnaire-id-1',
        ...dto,
      };

      questionnairesServiceMock.createQuestionnaire.mockResolvedValue(
        questionnaire,
      );

      const result = await controller.createQuestionnaire(dto);

      expect(
        questionnairesServiceMock.createQuestionnaire,
      ).toHaveBeenCalledWith(dto);

      expect(
        questionnairesServiceMock.createQuestionnaire,
      ).toHaveBeenCalledTimes(1);

      expect(result).toEqual(questionnaire);
    });

    it('deve retornar a lista de questionários', async () => {
      const questionnaires = [
        {
          id: 'questionnaire-id-1',
          name: 'Avaliação Geral',
        },
        {
          id: 'questionnaire-id-2',
          name: 'Avaliação de Teste',
        },
      ];

      questionnairesServiceMock.findQuestionnaires.mockResolvedValue(
        questionnaires,
      );

      const result = await controller.findQuestionnaires();

      expect(
        questionnairesServiceMock.findQuestionnaires,
      ).toHaveBeenCalledTimes(1);

      expect(result).toEqual(questionnaires);
    });

    it('deve consultar um questionário pelo ID', async () => {
      const questionnaireId = 'questionnaire-id-1';

      const questionnaire = {
        id: questionnaireId,
        name: 'Avaliação Geral',
        dimensions: [],
      };

      questionnairesServiceMock.findQuestionnaire.mockResolvedValue(
        questionnaire,
      );

      const result = await controller.findQuestionnaire(questionnaireId);

      expect(questionnairesServiceMock.findQuestionnaire).toHaveBeenCalledWith(
        questionnaireId,
      );

      expect(result).toEqual(questionnaire);
    });
  });

  describe('Dimensões', () => {
    it('deve encaminhar o cadastro de uma dimensão', async () => {
      const questionnaireId = 'questionnaire-id-1';

      const dto = {
        name: 'Organização da Disciplina',
        description: 'Avalia a organização da disciplina.',
        order: 1,
      };

      const dimension = {
        id: 'dimension-id-1',
        ...dto,
      };

      questionnairesServiceMock.createDimension.mockResolvedValue(dimension);

      const result = await controller.createDimension(questionnaireId, dto);

      expect(questionnairesServiceMock.createDimension).toHaveBeenCalledWith(
        questionnaireId,
        dto,
      );

      expect(questionnairesServiceMock.createDimension).toHaveBeenCalledTimes(
        1,
      );

      expect(result).toEqual(dimension);
    });
  });

  describe('Perguntas', () => {
    it('deve encaminhar o cadastro de uma pergunta', async () => {
      const dimensionId = 'dimension-id-1';

      const dto = {
        text: 'A disciplina foi bem organizada?',
        type: QuestionType.SCALE,
        required: true,
        order: 1,
        scaleMin: 1,
        scaleMax: 5,
      };

      const question = {
        id: 'question-id-1',
        ...dto,
      };

      questionnairesServiceMock.createQuestion.mockResolvedValue(question);

      const result = await controller.createQuestion(dimensionId, dto);

      expect(questionnairesServiceMock.createQuestion).toHaveBeenCalledWith(
        dimensionId,
        dto,
      );

      expect(questionnairesServiceMock.createQuestion).toHaveBeenCalledTimes(1);

      expect(result).toEqual(question);
    });
  });
});
