import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateDisciplineDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;
}
