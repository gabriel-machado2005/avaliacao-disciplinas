import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { EvaluationAnalysisQueryDto } from './dto/evaluation-analysis-query.dto';
import { EvaluationsService } from './evaluations.service';
import { UpdateEvaluationSettingsDto } from './dto/update-evaluation-settings.dto';
import { UpdateEvaluationPeriodDto } from './dto/update-evaluation-period.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';

@Controller('evaluations')
@ApiTags('Avaliações')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token ausente, inválido ou expirado, ou conta indisponível.',
})
@ApiForbiddenResponse({
  description: 'Perfil ou vínculo sem permissão para a operação.',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COORDINATOR)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post('periods')
  @ApiCreatedResponse({ description: 'Período de avaliação cadastrado.' })
  @ApiBadRequestResponse({
    description: 'Campos, datas ou horários inválidos.',
  })
  createPeriod(@Body() dto: CreateEvaluationPeriodDto) {
    return this.evaluationsService.createPeriod(dto);
  }

  @Patch('periods/:id')
  @ApiOkResponse({ description: 'Período atualizado.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({
    description: 'UUID, campos ou intervalo de datas inválidos.',
  })
  @ApiNotFoundResponse({ description: 'Período não encontrado.' })
  @ApiConflictResponse({
    description:
      'As datas não podem ser alteradas enquanto houver avaliações vinculadas.',
  })
  updatePeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationPeriodDto,
  ) {
    return this.evaluationsService.updatePeriod(id, dto);
  }

  @Delete('periods/:id')
  @ApiOkResponse({ description: 'Período excluído.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Período não encontrado.' })
  @ApiConflictResponse({ description: 'Período vinculado a avaliações.' })
  @Roles(UserRole.ADMIN)
  deletePeriod(@Param('id', ParseUUIDPipe) id: string) {
    return this.evaluationsService.deletePeriod(id);
  }

  @Get('periods')
  @ApiOkResponse({ description: 'Períodos de avaliação cadastrados.' })
  findPeriods() {
    return this.evaluationsService.findPeriods();
  }

  @Post()
  @ApiCreatedResponse({ description: 'Avaliação cadastrada.' })
  @ApiBadRequestResponse({
    description:
      'Campos inválidos, recurso inativo ou turma já avaliada nesse período.',
  })
  @ApiNotFoundResponse({
    description: 'Período, turma ou questionário não encontrado.',
  })
  createEvaluation(@Body() dto: CreateEvaluationDto) {
    return this.evaluationsService.createEvaluation(dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Avaliações cadastradas.' })
  findEvaluations() {
    return this.evaluationsService.findEvaluations();
  }

  @Get('analysis')
  @ApiOperation({
    summary: 'Analisar resultados e comparar períodos',
    description:
      'ADMIN ou COORDINATOR. Aplica os filtros aos dois períodos e usa apenas resultados divulgáveis.',
  })
  @ApiOkResponse({
    description:
      'Indicadores agregados por período e comparação de perguntas de escala compatíveis. Um período aberto ou sem resultados divulgáveis aparece com o estado correspondente.',
  })
  @ApiBadRequestResponse({
    description:
      'UUID inválido, filtro inexistente ou incompatível, ou períodos repetidos.',
  })
  @Header('Cache-Control', 'no-store')
  getAnalysis(@Query() query: EvaluationAnalysisQueryDto, @Req() req: any) {
    return this.evaluationsService.getAnalysis(query, req.user);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Avaliação excluída.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Avaliação não encontrada.' })
  @ApiConflictResponse({
    description: 'Avaliação com registros vinculados ou alteração concorrente.',
  })
  @Roles(UserRole.ADMIN)
  deleteEvaluation(@Param('id', ParseUUIDPipe) id: string) {
    return this.evaluationsService.deleteEvaluation(id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Avaliação atualizada.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID ou campos inválidos.' })
  @ApiNotFoundResponse({
    description: 'Avaliação, período, turma ou questionário não encontrado.',
  })
  @ApiConflictResponse({
    description:
      'Alteração incompatível com registros existentes ou alteração concorrente.',
  })
  updateEvaluation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationDto,
  ) {
    return this.evaluationsService.updateEvaluation(id, dto);
  }

  @Get('professor/my')
  @ApiOkResponse({ description: 'Avaliações das turmas do professor.' })
  @ApiOperation({
    summary: 'Listar avaliações das turmas do professor autenticado',
  })
  @Roles(UserRole.PROFESSOR)
  findProfessorEvaluations(@Req() req: any) {
    return this.evaluationsService.findProfessorEvaluations(req.user.userId);
  }

  @Post('eligibilities')
  @ApiCreatedResponse({ description: 'Estudante habilitado.' })
  @ApiBadRequestResponse({
    description:
      'Campos inválidos, estudante inativo ou habilitação já cadastrada.',
  })
  @ApiNotFoundResponse({
    description: 'Avaliação ou estudante não encontrado.',
  })
  createEligibility(@Body() dto: CreateEvaluationEligibilityDto) {
    return this.evaluationsService.createEligibility(dto);
  }

  @Delete('eligibilities/:eligibilityId')
  @ApiOkResponse({ description: 'Habilitação revogada.' })
  @ApiParam({
    name: 'eligibilityId',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Habilitação não encontrada.' })
  @ApiConflictResponse({ description: 'O estudante já concluiu a avaliação.' })
  revokeEligibility(
    @Param('eligibilityId', ParseUUIDPipe) eligibilityId: string,
  ) {
    return this.evaluationsService.revokeEligibility(eligibilityId);
  }

  @Get(':evaluationId/eligibilities')
  @ApiOkResponse({ description: 'Habilitações da avaliação.' })
  @ApiParam({
    name: 'evaluationId',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Avaliação não encontrada.' })
  findEligibilities(
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
  ) {
    return this.evaluationsService.findEligibilities(evaluationId);
  }

  @Get('my')
  @ApiOkResponse({ description: 'Avaliações vinculadas ao estudante.' })
  @ApiOperation({ summary: 'Listar avaliações do estudante autenticado' })
  @Roles(UserRole.STUDENT)
  findMyEvaluations(@Req() req: any) {
    return this.evaluationsService.findMyEvaluations(req.user.userId);
  }

  @Get(':evaluationId/questionnaire')
  @ApiOkResponse({ description: 'Questionário disponível para o estudante.' })
  @ApiParam({
    name: 'evaluationId',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBadRequestResponse({
    description: 'UUID inválido ou avaliação indisponível para resposta.',
  })
  @ApiNotFoundResponse({
    description: 'Avaliação não encontrada para o estudante.',
  })
  @Roles(UserRole.STUDENT)
  getQuestionnaireForStudent(
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Req() req: any,
  ) {
    return this.evaluationsService.findQuestionnaireForStudent(
      evaluationId,
      req.user.userId,
    );
  }

  @Post(':evaluationId/submissions')
  @ApiParam({
    name: 'evaluationId',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiCreatedResponse({ description: 'Respostas registradas.' })
  @ApiBadRequestResponse({
    description:
      'UUID ou respostas inválidas, avaliação indisponível ou já concluída.',
  })
  @ApiNotFoundResponse({ description: 'Avaliação não encontrada.' })
  @ApiForbiddenResponse({
    description:
      'Perfil sem permissão ou estudante não habilitado para a avaliação.',
  })
  @Roles(UserRole.STUDENT)
  submitEvaluation(
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
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
  @ApiOperation({
    summary: 'Consultar resultados agregados da avaliação',
    description:
      'ADMIN, COORDINATOR ou PROFESSOR da turma. Estatísticas por pergunta respeitam o limiar de respostas. Comentários individuais permanecem protegidos.',
  })
  @ApiParam({
    name: 'evaluationId',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({
    description:
      'Resultados agregados, com a identificação e o estado de divulgação de cada pergunta.',
  })
  @ApiBadRequestResponse({
    description:
      'UUID inválido, período aberto, mínimo de respostas não configurado ou total abaixo do mínimo.',
  })
  @ApiNotFoundResponse({ description: 'Avaliação não encontrada.' })
  @Header('Cache-Control', 'no-store')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.PROFESSOR)
  getResults(
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Req() req: any,
  ) {
    return this.evaluationsService.getResults(evaluationId, req.user);
  }

  @Patch(':evaluationId/settings')
  @ApiOkResponse({ description: 'Quantidade mínima de respostas atualizada.' })
  @ApiParam({
    name: 'evaluationId',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBadRequestResponse({
    description: 'UUID ou quantidade mínima de respostas inválidos.',
  })
  @ApiNotFoundResponse({ description: 'Avaliação não encontrada.' })
  updateEvaluationSettings(
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Body() dto: UpdateEvaluationSettingsDto,
  ) {
    return this.evaluationsService.updateEvaluationSettings(evaluationId, dto);
  }
}
