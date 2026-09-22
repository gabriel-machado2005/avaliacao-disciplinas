import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { EvaluationPeriod } from './entities/evaluation-period.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EvaluationPeriod,
    ]),

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
})
export class EvaluationsModule {}