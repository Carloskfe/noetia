import { IsArray, IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
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
}
