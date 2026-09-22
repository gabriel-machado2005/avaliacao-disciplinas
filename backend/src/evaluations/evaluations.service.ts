import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEvaluationPeriodDto } from './dto/create-evaluation-period.dto';
import { EvaluationPeriod } from './entities/evaluation-period.entity';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(EvaluationPeriod)
    private readonly evaluationPeriodRepository:
      Repository<EvaluationPeriod>,
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
}