import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
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
      User,
    ]),

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
  ],
  controllers: [AcademicController],
  providers: [AcademicService],
})
export class AcademicModule {}