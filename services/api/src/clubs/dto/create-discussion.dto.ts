import { IsInt, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDiscussionDto {
  @IsUUID()
  bookId: string;

  @IsInt()
  @Min(0)
  phraseIndex: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
