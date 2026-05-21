import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateClubDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @IsOptional()
  @IsEnum(['public', 'private'])
  type?: 'public' | 'private';

  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  tokenRequired?: boolean;
}
