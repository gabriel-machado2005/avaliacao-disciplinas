import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmissionAnswerDto {
  @IsUUID()
  questionId: string;

  @ApiPropertyOptional({
    type: 'integer',
    description: 'Valor enviado para pergunta SCALE.',
  })
  @IsOptional()
  @IsInt()
  scaleValue?: number;

  @ApiPropertyOptional({
    description: 'Alternativa enviada para pergunta SINGLE_CHOICE.',
  })
  @IsOptional()
  @IsString()
  choiceValue?: string;

  @ApiPropertyOptional({
    description:
      'Comentário enviado para pergunta TEXT. O texto individual é protegido nos resultados.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: 'O comentário deve ter no máximo 1000 caracteres.',
  })
  textValue?: string;
}

export class CreateSubmissionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmissionAnswerDto)
  answers: SubmissionAnswerDto[];
}
