import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { ClubType } from '../club.entity';

export class CreateClubDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @IsEnum(['public', 'private'])
  type: Extract<ClubType, 'public' | 'private'>;

  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  tokenRequired?: boolean;

  @IsString()
  bookId: string;
}
