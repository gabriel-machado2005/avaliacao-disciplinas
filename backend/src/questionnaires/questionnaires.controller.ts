import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { QuestionnairesService } from './questionnaires.service';

@Controller('questionnaires')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COORDINATOR)
export class QuestionnairesController {
  constructor(
    private readonly questionnairesService:
      QuestionnairesService,
  ) {}

  @Post()
  createQuestionnaire(
    @Body() dto: CreateQuestionnaireDto,
  ) {
    return this.questionnairesService.createQuestionnaire(
      dto,
    );
  }

  @Get()
  findQuestionnaires() {
    return this.questionnairesService.findQuestionnaires();
  }

  @Get(':id')
  findQuestionnaire(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.questionnairesService.findQuestionnaire(id);
  }

  @Post(':questionnaireId/dimensions')
  createDimension(
    @Param('questionnaireId', ParseUUIDPipe)
    questionnaireId: string,
    @Body() dto: CreateDimensionDto,
  ) {
    return this.questionnairesService.createDimension(
      questionnaireId,
      dto,
    );
  }

  @Post('dimensions/:dimensionId/questions')
  createQuestion(
    @Param('dimensionId', ParseUUIDPipe)
    dimensionId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionnairesService.createQuestion(
      dimensionId,
      dto,
    );
  }
}