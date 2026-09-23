import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassGroup } from '../academic/entities/class-group.entity';
import { Questionnaire } from '../questionnaires/entities/questionnaire.entity';
import { EvaluationPeriod } from './entities/evaluation-period.entity';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EvaluationPeriod,
      Evaluation,
      ClassGroup,
      Questionnaire,
    ]),

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
})
export class EvaluationsModule {}