import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateClassGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string;

  @IsUUID()
  disciplineId: string;

  @IsUUID()
  professorId: string;

  @IsUUID()
  academicTermId: string;
}