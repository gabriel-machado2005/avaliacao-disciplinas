import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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
  textValue?: string;
}

export class CreateSubmissionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmissionAnswerDto)
  answers: SubmissionAnswerDto[];
}