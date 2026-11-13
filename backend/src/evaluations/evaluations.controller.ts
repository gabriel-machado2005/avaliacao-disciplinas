import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UpdateEvaluationSettingsDto } from './dto/update-evaluation-settings.dto';
import { UpdateEvaluationPeriodDto } from './dto/update-evaluation-period.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COORDINATOR)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post('periods')
  createPeriod(@Body() dto: CreateEvaluationPeriodDto) {
    return this.evaluationsService.createPeriod(dto);
  }

  @Patch('periods/:id')
  updatePeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationPeriodDto,
  ) {
    return this.evaluationsService.updatePeriod(id, dto);
  }

  @Delete('periods/:id')
  @Roles(UserRole.ADMIN)
  deletePeriod(@Param('id', ParseUUIDPipe) id: string) {
    return this.evaluationsService.deletePeriod(id);
  }

  @Get('periods')
  findPeriods() {
    return this.evaluationsService.findPeriods();
  }

  @Post()
  createEvaluation(@Body() dto: CreateEvaluationDto) {
    return this.evaluationsService.createEvaluation(dto);
  }

  @Get()
  findEvaluations() {
    return this.evaluationsService.findEvaluations();
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  deleteEvaluation(@Param('id', ParseUUIDPipe) id: string) {
    return this.evaluationsService.deleteEvaluation(id);
  }

  @Patch(':id')
  updateEvaluation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationDto,
  ) {
    return this.evaluationsService.updateEvaluation(id, dto);
  }

  @Get('professor/my')
  @Roles(UserRole.PROFESSOR)
  findProfessorEvaluations(@Req() req: any) {
    return this.evaluationsService.findProfessorEvaluations(req.user.userId);
  }

  @Post('eligibilities')
  createEligibility(@Body() dto: CreateEvaluationEligibilityDto) {
    return this.evaluationsService.createEligibility(dto);
  }

  @Get(':evaluationId/eligibilities')
  findEligibilities(@Param('evaluationId') evaluationId: string) {
    return this.evaluationsService.findEligibilities(evaluationId);
  }

  @Get('my')
  @Roles(UserRole.STUDENT)
  findMyEvaluations(@Req() req: any) {
    return this.evaluationsService.findMyEvaluations(req.user.userId);
  }

  @Get(':evaluationId/questionnaire')
  @Roles(UserRole.STUDENT)
  getQuestionnaireForStudent(
    @Param('evaluationId') evaluationId: string,
    @Req() req: any,
  ) {
    return this.evaluationsService.findQuestionnaireForStudent(
      evaluationId,
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
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.PROFESSOR)
  getResults(@Param('evaluationId') evaluationId: string, @Req() req: any) {
    return this.evaluationsService.getResults(evaluationId, req.user);
  }

  @Patch(':evaluationId/settings')
  updateEvaluationSettings(
    @Param('evaluationId') evaluationId: string,
    @Body() dto: UpdateEvaluationSettingsDto,
  ) {
    return this.evaluationsService.updateEvaluationSettings(evaluationId, dto);
  }
}
