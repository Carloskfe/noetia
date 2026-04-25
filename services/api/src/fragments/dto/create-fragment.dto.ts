import { IsString, IsUUID } from 'class-validator';

export class CreateFragmentDto {
  @IsUUID()
  bookId: string;

  @IsString()
  text: string;
}
