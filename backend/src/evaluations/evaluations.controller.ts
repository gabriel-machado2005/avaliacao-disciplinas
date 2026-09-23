import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateEvaluationPeriodDto } from './dto/create-evaluation-period.dto';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COORDINATOR)
export class EvaluationsController {
  constructor(
    private readonly evaluationsService: EvaluationsService,
  ) {}

  @Post('periods')
  createPeriod(
    @Body() dto: CreateEvaluationPeriodDto,
  ) {
    return this.evaluationsService.createPeriod(dto);
  }

  @Get('periods')
  findPeriods() {
    return this.evaluationsService.findPeriods();
  }
  @Post()
  createEvaluation(
  @Body() dto: CreateEvaluationDto,
  ) {
  return this.evaluationsService.createEvaluation(dto);
  }

  @Get()
  findEvaluations() {
  return this.evaluationsService.findEvaluations();
  }
}