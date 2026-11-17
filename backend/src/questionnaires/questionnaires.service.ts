import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { auditedWrite, auditSave } from '../audit/administrative-audit';
import { Evaluation } from '../evaluations/entities/evaluation.entity';
import { CreateDimensionDto } from './dto/create-dimension.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto';
import { Dimension } from './entities/dimension.entity';
import { Question, QuestionType } from './entities/question.entity';
import { MAX_SCALE_SPAN, MAX_SCALE_VALUE, MIN_SCALE_VALUE } from './question-scale';
import { Questionnaire } from './entities/questionnaire.entity';

@Injectable()
export class QuestionnairesService {
  constructor(
    @InjectRepository(Questionnaire)
    private readonly questionnaireRepository: Repository<Questionnaire>,

    @InjectRepository(Dimension)
    private readonly dimensionRepository: Repository<Dimension>,

    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,

    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
  ) {}

  createQuestionnaire(dto: CreateQuestionnaireDto) {
    const questionnaire = this.questionnaireRepository.create({
      name: dto.name,
      description: dto.description ?? null,
    });

    return auditSave(
      this.questionnaireRepository,
      questionnaire,
      'CREATE',
      'QUESTIONNAIRE',
    );
  }

  findQuestionnaires() {
    return this.questionnaireRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async updateQuestionnaire(id: string, dto: UpdateQuestionnaireDto) {
    const questionnaire = await this.questionnaireRepository.findOne({
      where: { id },
    });

    if (!questionnaire) {
      throw new NotFoundException('Questionário não encontrado.');
    }

    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'Informe pelo menos um campo para atualizar.',
      );
    }

    if (dto.name !== undefined) {
      if (
        typeof dto.name !== 'string' ||
        !dto.name.trim() ||
        dto.name.trim().length > 150
      ) {
        throw new BadRequestException(
          'Informe um nome válido de até 150 caracteres.',
        );
      }

      questionnaire.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      if (dto.description !== null && typeof dto.description !== 'string') {
        throw new BadRequestException('Informe uma descrição válida.');
      }

      questionnaire.description = dto.description?.trim() || null;
    }

    return auditSave(
      this.questionnaireRepository,
      questionnaire,
      'UPDATE',
      'QUESTIONNAIRE',
    );
  }

  async findQuestionnaire(id: string) {
    const questionnaire = await this.questionnaireRepository.findOne({
      where: { id },
      relations: {
        dimensions: {
          questions: true,
        },
      },
    });

    if (!questionnaire) {
      throw new NotFoundException('Questionário não encontrado.');
    }

    questionnaire.dimensions.sort((a, b) => a.order - b.order);

    for (const dimension of questionnaire.dimensions) {
      dimension.questions.sort((a, b) => a.order - b.order);
    }

    return questionnaire;
  }

  async deleteQuestionnaire(id: string) {
    const questionnaire = await this.questionnaireRepository.findOne({
      where: { id },
    });

    if (!questionnaire) {
      throw new NotFoundException('Questionário não encontrado.');
    }

    const evaluationCount = await this.evaluationRepository.count({
      where: {
        questionnaire: { id },
      },
    });

    if (evaluationCount > 0) {
      throw new ConflictException(
        'Este questionário não pode ser excluído porque está vinculado a uma ou mais avaliações.',
      );
    }

    await auditedWrite(
      this.questionnaireRepository,
      'DELETE',
      'QUESTIONNAIRE',
      (repo) => repo.remove(questionnaire),
      () => id,
    );

    return {
      message: 'Questionário excluído com sucesso.',
    };
  }

  async createDimension(questionnaireId: string, dto: CreateDimensionDto) {
    const questionnaire = await this.questionnaireRepository.findOne({
      where: { id: questionnaireId },
    });

    if (!questionnaire) {
      throw new NotFoundException('Questionário não encontrado.');
    }

    const dimension = this.dimensionRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      order: dto.order ?? 0,
      questionnaire,
    });

    return auditSave(this.dimensionRepository, dimension, 'CREATE', 'DIMENSION');
  }

  async createQuestion(dimensionId: string, dto: CreateQuestionDto) {
    const dimension = await this.dimensionRepository.findOne({
      where: { id: dimensionId },
    });

    if (!dimension) {
      throw new NotFoundException('Dimensão não encontrada.');
    }

    let scaleMin: number | null = null;
    let scaleMax: number | null = null;
    let options: string[] | null = null;

    if (dto.type === QuestionType.SCALE) {
      const { scaleMin: min, scaleMax: max } = dto;
      if (typeof min !== 'number' || typeof max !== 'number') {
        throw new BadRequestException(
          'Questões do tipo SCALE precisam de scaleMin e scaleMax.',
        );
      }

      if (
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        min < MIN_SCALE_VALUE ||
        min > MAX_SCALE_VALUE ||
        max < MIN_SCALE_VALUE ||
        max > MAX_SCALE_VALUE
      ) {
        throw new BadRequestException(
          `Os limites da escala devem ser inteiros de ${MIN_SCALE_VALUE} a ${MAX_SCALE_VALUE}.`,
        );
      }

      if (max <= min) {
        throw new BadRequestException('scaleMax deve ser maior que scaleMin.');
      }

      if (max - min > MAX_SCALE_SPAN) {
        throw new BadRequestException(
          `A diferença entre o máximo e o mínimo da escala deve ser de até ${MAX_SCALE_SPAN} pontos.`,
        );
      }

      scaleMin = min;
      scaleMax = max;
    }

    if (dto.type === QuestionType.SINGLE_CHOICE) {
      if (!dto.options || dto.options.length < 2) {
        throw new BadRequestException(
          'Questões de escolha única precisam de pelo menos duas opções.',
        );
      }

      options = dto.options;
    }

    const question = this.questionRepository.create({
      text: dto.text,
      type: dto.type,
      required: dto.required ?? false,
      order: dto.order ?? 0,
      scaleMin,
      scaleMax,
      options,
      dimension,
    });

    return auditSave(this.questionRepository, question, 'CREATE', 'QUESTION');
  }
}
