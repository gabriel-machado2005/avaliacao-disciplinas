import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateQuestionnaireDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, {
    message: 'O nome deve conter pelo menos um caractere válido.',
  })
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}
