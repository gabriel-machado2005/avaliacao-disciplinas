import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateDimensionDto } from './dto/create-dimension.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto';
import { QuestionnairesService } from './questionnaires.service';

@Controller('questionnaires')
@ApiTags('Questionários')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token ausente, inválido ou expirado, ou conta indisponível.',
})
@ApiForbiddenResponse({
  description: 'Perfil sem permissão para a operação. ADMIN ou COORDINATOR.',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COORDINATOR)
export class QuestionnairesController {
  constructor(private readonly questionnairesService: QuestionnairesService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Questionário cadastrado.' })
  @ApiBadRequestResponse({ description: 'Campos inválidos.' })
  createQuestionnaire(@Body() dto: CreateQuestionnaireDto) {
    return this.questionnairesService.createQuestionnaire(dto);
  }

  @Get()
  @ApiOkResponse({ description: 'Questionários cadastrados.' })
  findQuestionnaires() {
    return this.questionnairesService.findQuestionnaires();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Questionário com dimensões e perguntas.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Questionário não encontrado.' })
  findQuestionnaire(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionnairesService.findQuestionnaire(id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Questionário atualizado.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID, campos ou valores inválidos.' })
  @ApiNotFoundResponse({ description: 'Questionário não encontrado.' })
  updateQuestionnaire(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionnaireDto,
  ) {
    return this.questionnairesService.updateQuestionnaire(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Questionário excluído.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Questionário não encontrado.' })
  @ApiConflictResponse({ description: 'Questionário vinculado a avaliações.' })
  deleteQuestionnaire(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionnairesService.deleteQuestionnaire(id);
  }

  @Post(':questionnaireId/dimensions')
  @ApiCreatedResponse({ description: 'Dimensão cadastrada.' })
  @ApiParam({
    name: 'questionnaireId',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBadRequestResponse({ description: 'UUID ou campos inválidos.' })
  @ApiNotFoundResponse({ description: 'Questionário não encontrado.' })
  createDimension(
    @Param('questionnaireId', ParseUUIDPipe)
    questionnaireId: string,
    @Body() dto: CreateDimensionDto,
  ) {
    return this.questionnairesService.createDimension(questionnaireId, dto);
  }

  @Post('dimensions/:dimensionId/questions')
  @ApiCreatedResponse({ description: 'Pergunta cadastrada.' })
  @ApiParam({ name: 'dimensionId', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({
    description: 'UUID, campos, limites da escala ou opções inválidas.',
  })
  @ApiNotFoundResponse({ description: 'Dimensão não encontrada.' })
  createQuestion(
    @Param('dimensionId', ParseUUIDPipe)
    dimensionId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionnairesService.createQuestion(dimensionId, dto);
  }
}
