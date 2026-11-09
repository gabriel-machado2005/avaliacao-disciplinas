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

@Controller('academic')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COORDINATOR)
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Post('courses')
  createCourse(@Body() dto: CreateCourseDto) {
    return this.academicService.createCourse(dto);
  }

  @Patch('courses/:id')
  updateCourse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.academicService.updateCourse(id, dto);
  }

  @Delete('courses/:id')
  @Roles(UserRole.ADMIN)
  deleteCourse(@Param('id', ParseUUIDPipe) id: string) {
    return this.academicService.deleteCourse(id);
  }

  @Get('courses')
  findCourses() {
    return this.academicService.findCourses();
  }

  @Post('disciplines')
  createDiscipline(@Body() dto: CreateDisciplineDto) {
    return this.academicService.createDiscipline(dto);
  }

  @Get('disciplines')
  findDisciplines() {
    return this.academicService.findDisciplines();
  }

  @Post('terms')
  createAcademicTerm(@Body() dto: CreateAcademicTermDto) {
    return this.academicService.createAcademicTerm(dto);
  }

  @Get('terms')
  findAcademicTerms() {
    return this.academicService.findAcademicTerms();
  }

  @Post('classes')
  createClassGroup(@Body() dto: CreateClassGroupDto) {
    return this.academicService.createClassGroup(dto);
  }

  @Get('classes')
  findClasses() {
    return this.academicService.findClasses();
  }
}
