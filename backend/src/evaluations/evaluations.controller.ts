import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CreateEvaluationEligibilityDto } from './dto/create-evaluation-eligibility.dto';
import { CreateEvaluationPeriodDto } from './dto/create-evaluation-period.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { EvaluationsService } from './evaluations.service';

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

  @Post('eligibilities')
  createEligibility(
    @Body() dto: CreateEvaluationEligibilityDto,
  ) {
    return this.evaluationsService.createEligibility(dto);
  }

  @Get(':evaluationId/eligibilities')
  findEligibilities(
    @Param('evaluationId') evaluationId: string,
  ) {
    return this.evaluationsService.findEligibilities(
      evaluationId,
    );
  }

  @Get('my')
  @Roles(UserRole.STUDENT)
  findMyEvaluations(
    @Req() req: any,
  ) {
    return this.evaluationsService.findMyEvaluations(
      req.user.userId,
    );
  }

  @Post(':evaluationId/submissions')
  @Roles(UserRole.STUDENT)
  submitEvaluation(
    @Param('evaluationId') evaluationId: string,
    @Req() req: any,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.evaluationsService.submitEvaluation(
      evaluationId,
      req.user.userId,
      dto,
    );
  }

  @Get(':evaluationId/results')
  @Roles(
    UserRole.ADMIN,
    UserRole.COORDINATOR,
    UserRole.PROFESSOR,
  )
  getResults(
    @Param('evaluationId') evaluationId: string,
    @Req() req: any,
  ) {
    return this.evaluationsService.getResults(
      evaluationId,
      req.user,
    );
  }
}