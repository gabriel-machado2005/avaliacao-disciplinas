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
import {
  CreateImprovementPlanDto,
  ImprovementPlanComparisonQueryDto,
  ListImprovementPlansDto,
  UpdateImprovementPlanDto,
  UpdateImprovementPlanComparisonDto,
  UpdateImprovementPlanStatusDto,
} from './dto/improvement-plan.dto';
import {
  ImprovementPlansService,
  type PlanRequester,
} from './improvement-plans.service';

@Controller('improvement-plans')
@ApiTags('Planos de melhoria')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token ausente, inválido ou expirado, ou conta indisponível.',
})
@ApiForbiddenResponse({ description: 'Perfil sem permissão para a operação.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COORDINATOR)
export class ImprovementPlansController {
  constructor(private readonly service: ImprovementPlansService) {}

  @Get('assignees')
  @ApiOkResponse({
    description:
      'Administradores, coordenadores e professores ativos disponíveis como responsáveis.',
  })
  @Header('Cache-Control', 'no-store')
  findAssignees(@Req() request: { user: PlanRequester }) {
    return this.service.findAssignees(request.user);
  }

  @Get()
  @ApiOkResponse({
    description: 'Planos que atendem aos filtros e ao escopo do usuário.',
  })
  @ApiOperation({
    summary: 'Listar planos de melhoria',
    description:
      'ADMIN e COORDINATOR podem consultar os planos. PROFESSOR consulta os planos atribuídos a ele.',
  })
  @ApiBadRequestResponse({
    description: 'UUID de filtro ou situação inválida.',
  })
  @Header('Cache-Control', 'no-store')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.PROFESSOR)
  findAll(
    @Query() query: ListImprovementPlansDto,
    @Req() request: { user: PlanRequester },
  ) {
    return this.service.findAll(query, request.user);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Detalhe do plano e histórico de situações.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({
    description: 'Plano inexistente ou fora do escopo do professor.',
  })
  @Header('Cache-Control', 'no-store')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.PROFESSOR)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: { user: PlanRequester },
  ) {
    return this.service.findOne(id, request.user);
  }

  @Get(':id/comparison')
  @ApiOperation({
    summary: 'Consultar a comparação de acompanhamento',
    description:
      'ADMIN ou COORDINATOR. Compara a origem do plano com um período posterior da mesma disciplina.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    description:
      'Comparação agregada ou estado explicativo (NO_ORIGIN, SELECT_PERIOD, INVALID_PERIOD, OPEN, NO_RESULTS ou NO_COMPATIBLE_QUESTIONS).',
  })
  @ApiBadRequestResponse({
    description: 'UUID do plano ou do período inválido.',
  })
  @ApiNotFoundResponse({ description: 'Plano não encontrado.' })
  @Header('Cache-Control', 'no-store')
  getComparison(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ImprovementPlanComparisonQueryDto,
    @Req() request: { user: PlanRequester },
  ) {
    return this.service.getComparison(id, query.periodId, request.user);
  }

  @Patch(':id/comparison')
  @ApiOperation({
    summary: 'Vincular ou remover o período de acompanhamento',
    description:
      'ADMIN ou COORDINATOR. O vínculo exige uma comparação disponível e é independente da situação do plano.',
  })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ description: 'Comparação e vínculo atualizado.' })
  @ApiBadRequestResponse({
    description:
      'UUID inválido ou comparação indisponível para o período informado.',
  })
  @ApiNotFoundResponse({ description: 'Plano não encontrado.' })
  @ApiConflictResponse({
    description: 'O plano foi atualizado em outra consulta.',
  })
  @Header('Cache-Control', 'no-store')
  updateComparison(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImprovementPlanComparisonDto,
    @Req() request: { user: PlanRequester },
  ) {
    return this.service.updateComparison(id, dto.periodId, request.user);
  }

  @Post()
  @ApiCreatedResponse({
    description:
      'Plano registrado como PENDING, com a primeira entrada no histórico.',
  })
  @ApiBadRequestResponse({
    description:
      'Campos inválidos, responsável inelegível, origens simultâneas ou avaliação de outra disciplina.',
  })
  create(
    @Body() dto: CreateImprovementPlanDto,
    @Req() request: { user: PlanRequester },
  ) {
    return this.service.create(dto, request.user);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Plano atualizado.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({
    description:
      'UUID ou campos inválidos, atualização vazia ou origem incompatível.',
  })
  @ApiNotFoundResponse({ description: 'Plano não encontrado.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImprovementPlanDto,
    @Req() request: { user: PlanRequester },
  ) {
    return this.service.update(id, dto, request.user);
  }

  @Patch(':id/status')
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({
    description:
      'Situação atualizada. Uma nova entrada no histórico é criada quando a situação muda.',
  })
  @ApiBadRequestResponse({ description: 'UUID ou situação inválida.' })
  @ApiNotFoundResponse({
    description: 'Plano inexistente ou fora do escopo do professor.',
  })
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.PROFESSOR)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImprovementPlanStatusDto,
    @Req() request: { user: PlanRequester },
  ) {
    return this.service.updateStatus(id, dto, request.user);
  }
}
