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

  @IsOptional()
  @IsInt()
  scaleValue?: number;

  @IsOptional()
  @IsString()
  choiceValue?: string;

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
