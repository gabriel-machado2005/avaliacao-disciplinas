import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dimension } from './entities/dimension.entity';
import { Question } from './entities/question.entity';
import { Questionnaire } from './entities/questionnaire.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Questionnaire,
      Dimension,
      Question,
    ]),
  ],
})
export class QuestionnairesModule {}