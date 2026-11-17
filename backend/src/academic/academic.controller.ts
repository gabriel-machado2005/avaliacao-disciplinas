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
import { AcademicService } from './academic.service';
import { CreateAcademicTermDto } from './dto/create-academic-term.dto';
import { CreateClassGroupDto } from './dto/create-class-group.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';
import { UpdateAcademicTermDto } from './dto/update-academic-term.dto';
import { UpdateClassGroupDto } from './dto/update-class-group.dto';

@Controller('academic')
@ApiTags('Gestão acadêmica')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token ausente, inválido ou expirado, ou conta indisponível.',
})
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação. ADMIN ou COORDINATOR. As exclusões exigem ADMIN.',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COORDINATOR)
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Post('courses')
  @ApiCreatedResponse({ description: 'Curso cadastrado.' })
  @ApiBadRequestResponse({
    description: 'Campos inválidos ou código de curso duplicado.',
  })
  createCourse(@Body() dto: CreateCourseDto) {
    return this.academicService.createCourse(dto);
  }

  @Patch('courses/:id')
  @ApiOkResponse({ description: 'Curso atualizado.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({
    description: 'UUID, campos ou código de curso inválidos.',
  })
  @ApiNotFoundResponse({ description: 'Curso não encontrado.' })
  updateCourse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.academicService.updateCourse(id, dto);
  }

  @Delete('courses/:id')
  @ApiOkResponse({ description: 'Curso excluído.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Curso não encontrado.' })
  @ApiConflictResponse({ description: 'Curso vinculado a disciplinas.' })
  @Roles(UserRole.ADMIN)
  deleteCourse(@Param('id', ParseUUIDPipe) id: string) {
    return this.academicService.deleteCourse(id);
  }

  @Get('courses')
  @ApiOkResponse({ description: 'Cursos cadastrados.' })
  findCourses() {
    return this.academicService.findCourses();
  }

  @Post('disciplines')
  @ApiCreatedResponse({ description: 'Disciplina cadastrada.' })
  @ApiBadRequestResponse({
    description: 'Campos inválidos ou código de disciplina duplicado.',
  })
  @ApiNotFoundResponse({ description: 'Curso não encontrado.' })
  createDiscipline(@Body() dto: CreateDisciplineDto) {
    return this.academicService.createDiscipline(dto);
  }

  @Patch('disciplines/:id')
  @ApiOkResponse({ description: 'Disciplina atualizada.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID ou campos inválidos.' })
  @ApiNotFoundResponse({ description: 'Disciplina ou curso não encontrado.' })
  @ApiConflictResponse({
    description: 'Alteração de curso impedida por turmas vinculadas.',
  })
  updateDiscipline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisciplineDto,
  ) {
    return this.academicService.updateDiscipline(id, dto);
  }

  @Delete('disciplines/:id')
  @ApiOkResponse({ description: 'Disciplina excluída.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Disciplina não encontrada.' })
  @ApiConflictResponse({ description: 'Disciplina com registros vinculados.' })
  @Roles(UserRole.ADMIN)
  deleteDiscipline(@Param('id', ParseUUIDPipe) id: string) {
    return this.academicService.deleteDiscipline(id);
  }

  @Get('disciplines')
  @ApiOkResponse({ description: 'Disciplinas cadastradas.' })
  findDisciplines() {
    return this.academicService.findDisciplines();
  }

  @Post('terms')
  @ApiCreatedResponse({ description: 'Semestre cadastrado.' })
  @ApiBadRequestResponse({
    description:
      'Campos inválidos, período duplicado ou intervalo de datas inválido.',
  })
  createAcademicTerm(@Body() dto: CreateAcademicTermDto) {
    return this.academicService.createAcademicTerm(dto);
  }

  @Patch('terms/:id')
  @ApiOkResponse({ description: 'Semestre atualizado.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({
    description: 'UUID, campos ou intervalo de datas inválidos.',
  })
  @ApiNotFoundResponse({ description: 'Semestre não encontrado.' })
  @ApiConflictResponse({
    description: 'Alteração de datas impedida por turmas vinculadas.',
  })
  updateAcademicTerm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicTermDto,
  ) {
    return this.academicService.updateAcademicTerm(id, dto);
  }

  @Delete('terms/:id')
  @ApiOkResponse({ description: 'Semestre excluído.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Semestre não encontrado.' })
  @ApiConflictResponse({ description: 'Semestre vinculado a turmas.' })
  @Roles(UserRole.ADMIN)
  deleteAcademicTerm(@Param('id', ParseUUIDPipe) id: string) {
    return this.academicService.deleteAcademicTerm(id);
  }

  @Get('terms')
  @ApiOkResponse({ description: 'Semestres cadastrados.' })
  findAcademicTerms() {
    return this.academicService.findAcademicTerms();
  }

  @Post('classes')
  @ApiCreatedResponse({ description: 'Turma cadastrada.' })
  @ApiBadRequestResponse({
    description:
      'Campos inválidos ou usuário indicado sem perfil de professor.',
  })
  @ApiNotFoundResponse({
    description: 'Disciplina, professor ou semestre não encontrado.',
  })
  createClassGroup(@Body() dto: CreateClassGroupDto) {
    return this.academicService.createClassGroup(dto);
  }

  @Patch('classes/:id')
  @ApiOkResponse({ description: 'Turma atualizada.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID ou campos inválidos.' })
  @ApiNotFoundResponse({
    description: 'Turma ou um dos vínculos informados não encontrado.',
  })
  @ApiConflictResponse({
    description: 'Alteração de vínculo impedida por avaliações existentes.',
  })
  updateClassGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassGroupDto,
  ) {
    return this.academicService.updateClassGroup(id, dto);
  }

  @Delete('classes/:id')
  @ApiOkResponse({ description: 'Turma excluída.' })
  @ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiBadRequestResponse({ description: 'UUID inválido.' })
  @ApiNotFoundResponse({ description: 'Turma não encontrada.' })
  @ApiConflictResponse({ description: 'Turma vinculada a avaliações.' })
  @Roles(UserRole.ADMIN)
  deleteClassGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.academicService.deleteClassGroup(id);
  }

  @Get('classes')
  @ApiOkResponse({ description: 'Turmas cadastradas.' })
  findClasses() {
    return this.academicService.findClasses();
  }
}
