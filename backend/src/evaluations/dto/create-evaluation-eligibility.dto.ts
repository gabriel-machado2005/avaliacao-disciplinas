import { IsUUID } from 'class-validator';

export class CreateEvaluationEligibilityDto {
  @IsUUID()
  evaluationId: string;

  @IsUUID()
  studentId: string;
}