import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImprovementPlanStatusHistory } from './entities/improvement-plan-status-history.entity';
import { ImprovementPlan } from './entities/improvement-plan.entity';
import { ImprovementPlansController } from './improvement-plans.controller';
import { ImprovementPlansService } from './improvement-plans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImprovementPlan, ImprovementPlanStatusHistory]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [ImprovementPlansController],
  providers: [ImprovementPlansService],
})
export class ImprovementPlansModule {}
