import { IsInt, Min } from 'class-validator';

export class UpdateEvaluationSettingsDto {
  @IsInt()
  @Min(2)
  minResponsesForResults: number;
}
