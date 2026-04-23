import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookCategory } from '../book.entity';

export class CreateBookDto {
  @IsString()
  title: string;

  @IsString()
  author: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsEnum(BookCategory)
  category: BookCategory;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;
}
