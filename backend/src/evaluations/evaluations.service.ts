import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassGroup } from '../academic/entities/class-group.entity';
import { Questionnaire } from '../questionnaires/entities/questionnaire.entity';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CreateEvaluationPeriodDto } from './dto/create-evaluation-period.dto';
import { EvaluationPeriod } from './entities/evaluation-period.entity';
import { Evaluation } from './entities/evaluation.entity';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(EvaluationPeriod)
    private readonly evaluationPeriodRepository:
      Repository<EvaluationPeriod>,

    @InjectRepository(Evaluation)
    private readonly evaluationRepository:
      Repository<Evaluation>,

    @InjectRepository(ClassGroup)
    private readonly classGroupRepository:
      Repository<ClassGroup>,

    @InjectRepository(Questionnaire)
    private readonly questionnaireRepository:
      Repository<Questionnaire>,
  ) {}

  async createPeriod(dto: CreateEvaluationPeriodDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException(
        'A data final deve ser posterior à data inicial.',
      );
    }

    const period = this.evaluationPeriodRepository.create({
      name: dto.name,
      startDate,
      endDate,
    });

    return this.evaluationPeriodRepository.save(period);
  }

  findPeriods() {
    return this.evaluationPeriodRepository.find({
      order: {
        startDate: 'DESC',
      },
    });
  }

  async createEvaluation(dto: CreateEvaluationDto) {
    const evaluationPeriod =
      await this.evaluationPeriodRepository.findOne({
        where: { id: dto.evaluationPeriodId },
      });

    if (!evaluationPeriod) {
      throw new NotFoundException(
        'Período de avaliação não encontrado.',
      );
    }

    if (!evaluationPeriod.active) {
      throw new BadRequestException(
        'O período de avaliação está inativo.',
      );
    }

    const classGroup =
      await this.classGroupRepository.findOne({
        where: { id: dto.classGroupId },
      });

    if (!classGroup) {
      throw new NotFoundException(
        'Turma não encontrada.',
      );
    }

    const questionnaire =
      await this.questionnaireRepository.findOne({
        where: { id: dto.questionnaireId },
      });

    if (!questionnaire) {
      throw new NotFoundException(
        'Questionário não encontrado.',
      );
    }

    if (!questionnaire.active) {
      throw new BadRequestException(
        'O questionário está inativo.',
      );
    }

    const existing =
      await this.evaluationRepository.findOne({
        where: {
          evaluationPeriod: {
            id: dto.evaluationPeriodId,
          },
          classGroup: {
            id: dto.classGroupId,
          },
        },
      });

    if (existing) {
      throw new BadRequestException(
        'Já existe uma avaliação para esta turma neste período.',
      );
    }

    const evaluation =
      this.evaluationRepository.create({
        evaluationPeriod,
        classGroup,
        questionnaire,
      });

    return this.evaluationRepository.save(evaluation);
  }

  findEvaluations() {
    return this.evaluationRepository.find({
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
  }
}