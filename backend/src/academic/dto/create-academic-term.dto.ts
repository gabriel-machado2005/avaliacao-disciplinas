import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAcademicTermDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}