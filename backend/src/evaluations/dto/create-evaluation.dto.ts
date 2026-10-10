import {
  IsInt,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateEvaluationDto {
  @IsUUID()
  evaluationPeriodId: string;

  @IsUUID()
  classGroupId: string;

  @IsUUID()
  questionnaireId: string;

  @IsInt()
  @Min(2)
  minResponsesForResults: number;
}