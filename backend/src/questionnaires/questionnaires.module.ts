import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dimension } from './entities/dimension.entity';
import { Question } from './entities/question.entity';
import { Questionnaire } from './entities/questionnaire.entity';
import { QuestionnairesController } from './questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Questionnaire,
      Dimension,
      Question,
    ]),

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
  ],
  controllers: [QuestionnairesController],
  providers: [QuestionnairesService],
})
export class QuestionnairesModule {}