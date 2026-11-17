import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ImprovementPlanStatus } from '../entities/improvement-plan.entity';

export class CreateImprovementPlanDto {
  @IsUUID()
  disciplineId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  problem: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  action: string;

  @IsUUID()
  assigneeId: string;

  @ApiProperty({ format: 'date', description: 'Prazo no formato AAAA-MM-DD.' })
  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/, {
    message: 'Informe o prazo no formato AAAA-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'Informe uma data válida para o prazo.' },
  )
  dueDate: string;

  @ApiPropertyOptional({
    description: 'Período de origem. Use apenas uma referência de origem.',
  })
  @IsOptional()
  @IsUUID()
  originPeriodId?: string | null;

  @ApiPropertyOptional({
    description:
      'Avaliação de origem da mesma disciplina. Use apenas uma referência de origem.',
  })
  @IsOptional()
  @IsUUID()
  originEvaluationId?: string | null;
}

export class UpdateImprovementPlanDto extends PartialType(
  OmitType(CreateImprovementPlanDto, ['disciplineId'] as const),
  { skipNullProperties: false },
) {}

export class UpdateImprovementPlanStatusDto {
  @IsEnum(ImprovementPlanStatus)
  status: ImprovementPlanStatus;
}

export class ListImprovementPlansDto {
  @ApiPropertyOptional({ description: 'Disciplina vinculada ao plano.' })
  @IsOptional()
  @IsUUID()
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Situação atual do plano.' })
  @IsOptional()
  @IsEnum(ImprovementPlanStatus)
  status?: ImprovementPlanStatus;

  @ApiPropertyOptional({
    description:
      'Responsável pelo plano. Para PROFESSOR, a consulta permanece limitada aos próprios planos.',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Período da origem direta ou da avaliação de origem.',
  })
  @IsOptional()
  @IsUUID()
  originPeriodId?: string;
}

export class ImprovementPlanComparisonQueryDto {
  @ApiPropertyOptional({
    description:
      'Período que começa após o encerramento da origem. Quando omitido, usa o período vinculado, se houver.',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}

export class UpdateImprovementPlanComparisonDto {
  @ApiProperty({
    description:
      'UUID do período posterior para vincular ou null para retirar o vínculo.',
  })
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  periodId: string | null;
}
