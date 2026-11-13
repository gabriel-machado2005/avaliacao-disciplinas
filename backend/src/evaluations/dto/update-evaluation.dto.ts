import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class UpdateEvaluationDto {
  @IsOptional()
  @IsUUID()
  evaluationPeriodId?: string;

  @IsOptional()
  @IsUUID()
  classGroupId?: string;

  @IsOptional()
  @IsUUID()
  questionnaireId?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  minResponsesForResults?: number;
}
