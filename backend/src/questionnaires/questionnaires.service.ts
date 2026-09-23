import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDimensionDto } from './dto/create-dimension.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { Dimension } from './entities/dimension.entity';
import {
  Question,
  QuestionType,
} from './entities/question.entity';
import { Questionnaire } from './entities/questionnaire.entity';

@Injectable()
export class QuestionnairesService {
  constructor(
    @InjectRepository(Questionnaire)
    private readonly questionnaireRepository:
      Repository<Questionnaire>,

    @InjectRepository(Dimension)
    private readonly dimensionRepository:
      Repository<Dimension>,

    @InjectRepository(Question)
    private readonly questionRepository:
      Repository<Question>,
  ) {}

  createQuestionnaire(dto: CreateQuestionnaireDto) {
    const questionnaire =
      this.questionnaireRepository.create({
        name: dto.name,
        description: dto.description ?? null,
      });

    return this.questionnaireRepository.save(questionnaire);
  }

  findQuestionnaires() {
    return this.questionnaireRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findQuestionnaire(id: string) {
    const questionnaire =
      await this.questionnaireRepository.findOne({
        where: { id },
        relations: {
          dimensions: {
            questions: true,
          },
        },
      });

    if (!questionnaire) {
      throw new NotFoundException(
        'Questionário não encontrado.',
      );
    }

    questionnaire.dimensions.sort(
      (a, b) => a.order - b.order,
    );

    for (const dimension of questionnaire.dimensions) {
      dimension.questions.sort(
        (a, b) => a.order - b.order,
      );
    }

    return questionnaire;
  }

  async createDimension(
    questionnaireId: string,
    dto: CreateDimensionDto,
  ) {
    const questionnaire =
      await this.questionnaireRepository.findOne({
        where: { id: questionnaireId },
      });

    if (!questionnaire) {
      throw new NotFoundException(
        'Questionário não encontrado.',
      );
    }

    const dimension = this.dimensionRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      order: dto.order ?? 0,
      questionnaire,
    });

    return this.dimensionRepository.save(dimension);
  }

  async createQuestion(
    dimensionId: string,
    dto: CreateQuestionDto,
  ) {
    const dimension =
      await this.dimensionRepository.findOne({
        where: { id: dimensionId },
      });

    if (!dimension) {
      throw new NotFoundException(
        'Dimensão não encontrada.',
      );
    }

    let scaleMin: number | null = null;
    let scaleMax: number | null = null;
    let options: string[] | null = null;

    if (dto.type === QuestionType.SCALE) {
      if (
        dto.scaleMin === undefined ||
        dto.scaleMax === undefined
      ) {
        throw new BadRequestException(
          'Questões do tipo SCALE precisam de scaleMin e scaleMax.',
        );
      }

      if (dto.scaleMax <= dto.scaleMin) {
        throw new BadRequestException(
          'scaleMax deve ser maior que scaleMin.',
        );
      }

      scaleMin = dto.scaleMin;
      scaleMax = dto.scaleMax;
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

    return this.questionRepository.save(question);
  }
}