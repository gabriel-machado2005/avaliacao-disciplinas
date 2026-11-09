import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCourseDto {
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
}
