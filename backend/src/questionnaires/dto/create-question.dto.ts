import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { QuestionType } from '../entities/question.entity';
import {
  MAX_SCALE_SPAN,
  MAX_SCALE_VALUE,
  MIN_SCALE_VALUE,
} from '../question-scale';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: MIN_SCALE_VALUE,
    maximum: MAX_SCALE_VALUE,
    description: 'Limite inferior obrigatório para perguntas SCALE.',
  })
  @IsOptional()
  @IsInt()
  scaleMin?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: MIN_SCALE_VALUE,
    maximum: MAX_SCALE_VALUE,
    description: `Limite superior obrigatório para SCALE. Deve ser maior que scaleMin, com diferença de até ${MAX_SCALE_SPAN}.`,
  })
  @IsOptional()
  @IsInt()
  scaleMax?: number;

  @ApiPropertyOptional({
    description: 'Perguntas SINGLE_CHOICE exigem pelo menos duas opções.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}
