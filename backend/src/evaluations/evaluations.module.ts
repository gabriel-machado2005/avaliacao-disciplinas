import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClassGroup } from '../academic/entities/class-group.entity';
import { Questionnaire } from '../questionnaires/entities/questionnaire.entity';
import { User } from '../users/entities/user.entity';

import { EvaluationEligibility } from './entities/evaluation-eligibility.entity';
import { EvaluationPeriod } from './entities/evaluation-period.entity';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { Answer } from './entities/answer.entity';
import { Submission } from './entities/submission.entity';
import { Question } from '../questionnaires/entities/question.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EvaluationPeriod,
      Evaluation,
      EvaluationEligibility,
      Submission,
      Answer,
      ClassGroup,
      Questionnaire,
      Question,
      User,
    ]),

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
})
export class EvaluationsModule {}