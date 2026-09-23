import { IsUUID } from 'class-validator';

export class CreateEvaluationDto {
  @IsUUID()
  evaluationPeriodId: string;

  @IsUUID()
  classGroupId: string;

  @IsUUID()
  questionnaireId: string;
}