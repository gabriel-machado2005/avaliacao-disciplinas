import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateEvaluationSettingsDto {
  @ApiProperty({ type: 'integer' })
  @IsInt()
  @Min(2)
  minResponsesForResults: number;
}
