import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import { UserType } from '../user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5)
  uiLanguage?: string;

  @IsOptional()
  @IsBoolean()
  shareReadingProgress?: boolean;

  @IsOptional()
  @IsBoolean()
  shareLibrary?: boolean;

  @IsOptional()
  @IsBoolean()
  shareProfile?: boolean;

  @IsOptional()
  @IsBoolean()
  shareFragments?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  goalWeeklyMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  goalWeeklyBooks?: number | null;
}
