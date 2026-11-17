import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateEvaluationDto {
  @IsUUID()
  evaluationPeriodId: string;

  @IsUUID()
  classGroupId: string;

  @IsUUID()
  questionnaireId: string;

  @ApiProperty({ type: 'integer' })
  @IsInt()
  @Min(2)
  minResponsesForResults: number;
}
