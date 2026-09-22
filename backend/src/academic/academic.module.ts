import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicTerm } from './entities/academic-term.entity';
import { ClassGroup } from './entities/class-group.entity';
import { Course } from './entities/course.entity';
import { Discipline } from './entities/discipline.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      Discipline,
      AcademicTerm,
      ClassGroup,
    ]),
  ],
})
export class AcademicModule {}