import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QuestionnairesService } from './questionnaires.service';
import { Evaluation } from '../evaluations/entities/evaluation.entity';
import { Questionnaire } from './entities/questionnaire.entity';
import { Dimension } from './entities/dimension.entity';
import { Question, QuestionType } from './entities/question.entity';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('QuestionnairesService', () => {
  let service: QuestionnairesService;

  const createRepositoryMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  });

  let questionnaireRepositoryMock: ReturnType<typeof createRepositoryMock>;
  let dimensionRepositoryMock: ReturnType<typeof createRepositoryMock>;
  let questionRepositoryMock: ReturnType<typeof createRepositoryMock>;
  let evaluationRepositoryMock: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    questionnaireRepositoryMock = createRepositoryMock();
    dimensionRepositoryMock = createRepositoryMock();
    questionRepositoryMock = createRepositoryMock();
    evaluationRepositoryMock = createRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionnairesService,
        {
          provide: getRepositoryToken(Questionnaire),
          useValue: questionnaireRepositoryMock,
        },
        {
          provide: getRepositoryToken(Dimension),
          useValue: dimensionRepositoryMock,
        },
        {
          provide: getRepositoryToken(Question),
          useValue: questionRepositoryMock,
        },
        {
          provide: getRepositoryToken(Evaluation),
          useValue: evaluationRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<QuestionnairesService>(QuestionnairesService);
  });

  it('deve criar o serviço de questionários corretamente', () => {
    expect(service).toBeDefined();
  });

  describe('Questionários', () => {
    it('deve cadastrar um questionário com descrição', async () => {
      const dto = {
        name: 'Avaliação Geral de Disciplinas',
        description: 'Questionário para avaliar as disciplinas.',
      };

      const questionnaire = {
        id: 'questionnaire-id-1',
        ...dto,
      };

      questionnaireRepositoryMock.create.mockReturnValue(questionnaire);
      questionnaireRepositoryMock.save.mockResolvedValue(questionnaire);

      const result = await service.createQuestionnaire(dto);

      expect(questionnaireRepositoryMock.create).toHaveBeenCalledWith({
        name: dto.name,
        description: dto.description,
      });

      expect(questionnaireRepositoryMock.save).toHaveBeenCalledWith(
        questionnaire,
      );

      expect(result).toEqual(questionnaire);
    });

    it('deve permitir cadastrar um questionário sem descrição', async () => {
      const dto = {
        name: 'Questionário de Teste',
      };

      const questionnaire = {
        id: 'questionnaire-id-2',
        name: dto.name,
        description: null,
      };

      questionnaireRepositoryMock.create.mockReturnValue(questionnaire);
      questionnaireRepositoryMock.save.mockResolvedValue(questionnaire);

      const result = await service.createQuestionnaire(dto);

      expect(questionnaireRepositoryMock.create).toHaveBeenCalledWith({
        name: dto.name,
        description: null,
      });

      expect(result).toEqual(questionnaire);
    });

    it('deve listar os questionários do mais recente para o mais antigo', async () => {
      const questionnaires = [
        {
          id: 'questionnaire-id-2',
          name: 'Questionário mais recente',
        },
        {
          id: 'questionnaire-id-1',
          name: 'Questionário mais antigo',
        },
      ];

      questionnaireRepositoryMock.find.mockResolvedValue(questionnaires);

      const result = await service.findQuestionnaires();

      expect(result).toEqual(questionnaires);

      expect(questionnaireRepositoryMock.find).toHaveBeenCalledWith({
        order: {
          createdAt: 'DESC',
        },
      });
    });

    it('deve consultar um questionário com dimensões e perguntas ordenadas', async () => {
      const questionnaire = {
        id: 'questionnaire-id-1',
        name: 'Avaliação Geral',
        dimensions: [
          {
            id: 'dimension-id-2',
            name: 'Metodologia de Ensino',
            order: 2,
            questions: [
              { id: 'question-id-3', text: 'Pergunta 3', order: 2 },
              { id: 'question-id-2', text: 'Pergunta 2', order: 1 },
            ],
          },
          {
            id: 'dimension-id-1',
            name: 'Organização da Disciplina',
            order: 1,
            questions: [{ id: 'question-id-1', text: 'Pergunta 1', order: 1 }],
          },
        ],
      };

      questionnaireRepositoryMock.findOne.mockResolvedValue(questionnaire);

      const result = await service.findQuestionnaire('questionnaire-id-1');

      expect(questionnaireRepositoryMock.findOne).toHaveBeenCalledWith({
        where: {
          id: 'questionnaire-id-1',
        },
        relations: {
          dimensions: {
            questions: true,
          },
        },
      });

      expect(result.dimensions.map((dimension) => dimension.order)).toEqual([
        1, 2,
      ]);

      expect(
        result.dimensions[1].questions.map((question) => question.order),
      ).toEqual([1, 2]);
    });

    it('deve rejeitar a consulta de um questionário inexistente', async () => {
      questionnaireRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.findQuestionnaire('invalid-questionnaire-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Edição de questionários', () => {
    const questionnaireId = 'questionnaire-id-1';

    beforeEach(() => {
      questionnaireRepositoryMock.findOne.mockResolvedValue({
        id: questionnaireId,
        name: 'Questionário original',
        description: 'Descrição original',
        active: true,
      });

      questionnaireRepositoryMock.save.mockImplementation(
        async (questionnaire) => questionnaire,
      );
    });

    it('deve atualizar somente o nome do questionário', async () => {
      const result = await service.updateQuestionnaire(questionnaireId, {
        name: '  Novo questionário  ',
      });

      expect(questionnaireRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: questionnaireId },
      });

      expect(result.name).toBe('Novo questionário');
      expect(result.description).toBe('Descrição original');
      expect(result.active).toBe(true);

      expect(questionnaireRepositoryMock.save).toHaveBeenCalledTimes(1);
    });

    it('deve atualizar somente a descrição', async () => {
      const result = await service.updateQuestionnaire(questionnaireId, {
        description: '  Nova descrição  ',
      });

      expect(result.name).toBe('Questionário original');
      expect(result.description).toBe('Nova descrição');

      expect(questionnaireRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Questionário original',
          description: 'Nova descrição',
        }),
      );
    });

    it('deve permitir remover a descrição', async () => {
      const result = await service.updateQuestionnaire(questionnaireId, {
        description: '',
      });

      expect(result.description).toBeNull();
      expect(result.name).toBe('Questionário original');
    });

    it('deve rejeitar um nome vazio ou inválido', async () => {
      await expect(
        service.updateQuestionnaire(questionnaireId, {
          name: '   ',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(questionnaireRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar atualização sem campos', async () => {
      await expect(
        service.updateQuestionnaire(questionnaireId, {}),
      ).rejects.toThrow(BadRequestException);

      expect(questionnaireRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar questionário inexistente', async () => {
      questionnaireRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateQuestionnaire(questionnaireId, {
          name: 'Novo nome',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(questionnaireRepositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('Exclusão de questionários', () => {
    const questionnaireId = 'questionnaire-id-1';

    it('deve excluir um questionário sem avaliações vinculadas', async () => {
      const questionnaire = {
        id: questionnaireId,
        name: 'Questionário de Teste',
      };

      questionnaireRepositoryMock.findOne.mockResolvedValue(questionnaire);
      evaluationRepositoryMock.count.mockResolvedValue(0);
      questionnaireRepositoryMock.remove.mockResolvedValue(questionnaire);

      const result = await service.deleteQuestionnaire(questionnaireId);

      expect(questionnaireRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: questionnaireId },
      });

      expect(evaluationRepositoryMock.count).toHaveBeenCalledWith({
        where: {
          questionnaire: { id: questionnaireId },
        },
      });

      expect(questionnaireRepositoryMock.remove).toHaveBeenCalledWith(
        questionnaire,
      );

      expect(result).toEqual({
        message: 'Questionário excluído com sucesso.',
      });
    });

    it('deve impedir a exclusão de questionário vinculado a avaliações', async () => {
      const questionnaire = {
        id: questionnaireId,
        name: 'Questionário em Uso',
      };

      questionnaireRepositoryMock.findOne.mockResolvedValue(questionnaire);
      evaluationRepositoryMock.count.mockResolvedValue(2);

      await expect(
        service.deleteQuestionnaire(questionnaireId),
      ).rejects.toThrow(ConflictException);

      expect(questionnaireRepositoryMock.remove).not.toHaveBeenCalled();
    });

    it('deve rejeitar a exclusão de questionário inexistente', async () => {
      questionnaireRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.deleteQuestionnaire(questionnaireId),
      ).rejects.toThrow(NotFoundException);

      expect(evaluationRepositoryMock.count).not.toHaveBeenCalled();
      expect(questionnaireRepositoryMock.remove).not.toHaveBeenCalled();
    });
  });

  describe('Dimensões', () => {
    it('deve cadastrar uma dimensão em um questionário existente', async () => {
      const questionnaireId = 'questionnaire-id-1';

      const dto = {
        name: 'Organização da Disciplina',
        description: 'Avalia a organização da disciplina.',
        order: 1,
      };

      const questionnaire = {
        id: questionnaireId,
        name: 'Avaliação Geral',
      };

      const dimension = {
        id: 'dimension-id-1',
        name: dto.name,
        description: dto.description,
        order: dto.order,
        questionnaire,
      };

      questionnaireRepositoryMock.findOne.mockResolvedValue(questionnaire);

      dimensionRepositoryMock.create.mockReturnValue(dimension);
      dimensionRepositoryMock.save.mockResolvedValue(dimension);

      const result = await service.createDimension(questionnaireId, dto);

      expect(questionnaireRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: questionnaireId },
      });

      expect(dimensionRepositoryMock.create).toHaveBeenCalledWith({
        name: dto.name,
        description: dto.description,
        order: dto.order,
        questionnaire,
      });

      expect(dimensionRepositoryMock.save).toHaveBeenCalledWith(dimension);

      expect(result).toEqual(dimension);
    });

    it('deve utilizar os valores padrão para descrição e ordem', async () => {
      const questionnaireId = 'questionnaire-id-1';

      const dto = {
        name: 'Metodologia de Ensino',
      };

      const questionnaire = {
        id: questionnaireId,
      };

      questionnaireRepositoryMock.findOne.mockResolvedValue(questionnaire);

      const dimension = {
        id: 'dimension-id-2',
        name: dto.name,
        description: null,
        order: 0,
        questionnaire,
      };

      dimensionRepositoryMock.create.mockReturnValue(dimension);
      dimensionRepositoryMock.save.mockResolvedValue(dimension);

      const result = await service.createDimension(questionnaireId, dto);

      expect(dimensionRepositoryMock.create).toHaveBeenCalledWith({
        name: dto.name,
        description: null,
        order: 0,
        questionnaire,
      });

      expect(result).toEqual(dimension);
    });

    it('deve rejeitar uma dimensão vinculada a questionário inexistente', async () => {
      const questionnaireId = 'invalid-questionnaire-id';

      const dto = {
        name: 'Organização da Disciplina',
        order: 1,
      };

      questionnaireRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.createDimension(questionnaireId, dto),
      ).rejects.toThrow(NotFoundException);

      expect(dimensionRepositoryMock.create).not.toHaveBeenCalled();
      expect(dimensionRepositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('Perguntas', () => {
    const dimensionId = 'dimension-id-1';

    const dimension = {
      id: dimensionId,
      name: 'Organização da Disciplina',
    };

    it('deve rejeitar uma pergunta vinculada a dimensão inexistente', async () => {
      dimensionRepositoryMock.findOne.mockResolvedValue(null);

      const dto = {
        text: 'Deixe um comentário.',
        type: QuestionType.TEXT,
      };

      await expect(service.createQuestion(dimensionId, dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(questionRepositoryMock.create).not.toHaveBeenCalled();
      expect(questionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve cadastrar uma pergunta do tipo SCALE', async () => {
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
        options: null,
        dimension,
      };

      dimensionRepositoryMock.findOne.mockResolvedValue(dimension);
      questionRepositoryMock.create.mockReturnValue(question);
      questionRepositoryMock.save.mockResolvedValue(question);

      const result = await service.createQuestion(dimensionId, dto);

      expect(dimensionRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: dimensionId },
      });

      expect(questionRepositoryMock.create).toHaveBeenCalledWith({
        text: dto.text,
        type: QuestionType.SCALE,
        required: true,
        order: 1,
        scaleMin: 1,
        scaleMax: 5,
        options: null,
        dimension,
      });

      expect(questionRepositoryMock.save).toHaveBeenCalledWith(question);

      expect(result).toEqual(question);
    });

    it('deve rejeitar uma pergunta SCALE sem os limites completos', async () => {
      dimensionRepositoryMock.findOne.mockResolvedValue(dimension);

      const dto = {
        text: 'Avalie a disciplina.',
        type: QuestionType.SCALE,
        scaleMin: 1,
      };

      await expect(service.createQuestion(dimensionId, dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(questionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve rejeitar uma escala com máximo igual ao mínimo', async () => {
      dimensionRepositoryMock.findOne.mockResolvedValue(dimension);

      const dto = {
        text: 'Avalie a disciplina.',
        type: QuestionType.SCALE,
        scaleMin: 5,
        scaleMax: 5,
      };

      await expect(service.createQuestion(dimensionId, dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(questionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve cadastrar uma pergunta do tipo SINGLE_CHOICE', async () => {
      const dto = {
        text: 'Como você avalia a organização?',
        type: QuestionType.SINGLE_CHOICE,
        required: true,
        order: 2,
        options: ['Ruim', 'Regular', 'Boa'],
      };

      const question = {
        id: 'question-id-2',
        ...dto,
        scaleMin: null,
        scaleMax: null,
        dimension,
      };

      dimensionRepositoryMock.findOne.mockResolvedValue(dimension);
      questionRepositoryMock.create.mockReturnValue(question);
      questionRepositoryMock.save.mockResolvedValue(question);

      const result = await service.createQuestion(dimensionId, dto);

      expect(questionRepositoryMock.create).toHaveBeenCalledWith({
        text: dto.text,
        type: QuestionType.SINGLE_CHOICE,
        required: true,
        order: 2,
        scaleMin: null,
        scaleMax: null,
        options: ['Ruim', 'Regular', 'Boa'],
        dimension,
      });

      expect(result).toEqual(question);
    });

    it('deve rejeitar uma pergunta SINGLE_CHOICE com apenas uma alternativa', async () => {
      dimensionRepositoryMock.findOne.mockResolvedValue(dimension);

      const dto = {
        text: 'Como você avalia a disciplina?',
        type: QuestionType.SINGLE_CHOICE,
        options: ['Boa'],
      };

      await expect(service.createQuestion(dimensionId, dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(questionRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('deve cadastrar uma pergunta TEXT com valores padrão', async () => {
      const dto = {
        text: 'Deixe um comentário sobre a disciplina.',
        type: QuestionType.TEXT,
      };

      const question = {
        id: 'question-id-3',
        text: dto.text,
        type: QuestionType.TEXT,
        required: false,
        order: 0,
        scaleMin: null,
        scaleMax: null,
        options: null,
        dimension,
      };

      dimensionRepositoryMock.findOne.mockResolvedValue(dimension);
      questionRepositoryMock.create.mockReturnValue(question);
      questionRepositoryMock.save.mockResolvedValue(question);

      const result = await service.createQuestion(dimensionId, dto);

      expect(questionRepositoryMock.create).toHaveBeenCalledWith({
        text: dto.text,
        type: QuestionType.TEXT,
        required: false,
        order: 0,
        scaleMin: null,
        scaleMax: null,
        options: null,
        dimension,
      });

      expect(questionRepositoryMock.save).toHaveBeenCalledWith(question);

      expect(result).toEqual(question);
    });
  });
});
