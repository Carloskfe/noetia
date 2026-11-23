import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import { UserType } from '../user.entity';
import { SUPPORTED_UI_LOCALES } from '../ui-locale';

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

  /** Interface locale. Only canonical values are accepted; `fr-CA` is additionally gated in the controller. */
  @IsOptional()
  @IsIn(SUPPORTED_UI_LOCALES)
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
  @IsBoolean()
  allowInsights?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  goalWeeklyMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  goalWeeklyBooks?: number | null;
}
