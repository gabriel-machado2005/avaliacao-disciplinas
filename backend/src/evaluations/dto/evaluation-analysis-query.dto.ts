import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class EvaluationAnalysisQueryDto {
  @ApiProperty({ description: 'Período principal de avaliação.' })
  @IsUUID()
  periodId: string;

  @ApiPropertyOptional({
    description: 'Segundo período, distinto do principal.',
  })
  @IsOptional()
  @IsUUID()
  comparisonPeriodId?: string;

  @ApiPropertyOptional({
    description: 'Curso das disciplinas incluídas no recorte.',
  })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({
    description:
      'Disciplina. Deve pertencer ao curso informado, quando houver.',
  })
  @IsOptional()
  @IsUUID()
  disciplineId?: string;

  @ApiPropertyOptional({
    description: 'Professor responsável pelas turmas incluídas.',
  })
  @IsOptional()
  @IsUUID()
  professorId?: string;

  @ApiPropertyOptional({
    description:
      'Dimensão das perguntas de escala. O filtro não altera a participação.',
  })
  @IsOptional()
  @IsUUID()
  dimensionId?: string;
}
