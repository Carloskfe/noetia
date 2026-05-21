import { ArrayMaxSize, ArrayMinSize, IsDateString, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePollDto {
  @IsString()
  @MaxLength(255)
  question: string;

  @IsUUID('4', { each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  bookIds: string[];

  @IsDateString()
  closesAt: string;
}
