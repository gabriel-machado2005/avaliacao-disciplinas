import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateClassGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code?: string;

  @IsOptional()
  @IsUUID()
  disciplineId?: string;

  @IsOptional()
  @IsUUID()
  professorId?: string;

  @IsOptional()
  @IsUUID()
  academicTermId?: string;
}
