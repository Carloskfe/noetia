import { IsDateString, IsInt, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateSessionDto {
  @IsUUID()
  bookId: string;

  @IsString()
  @MaxLength(150)
  title: string;

  @IsDateString()
  scheduledAt: string;

  @IsInt()
  @Min(0)
  startPhraseIndex: number;

  @IsInt()
  @Min(1)
  endPhraseIndex: number;
}
