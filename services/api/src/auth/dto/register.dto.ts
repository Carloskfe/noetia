import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SUPPORTED_UI_LOCALES } from '../../users/ui-locale';

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  /**
   * Interface language the reader registered from (NEM-025 B2-A2a). Optional: old clients omit it and
   * register in Spanish. Canonical values only; `fr-CA` is additionally gated in AuthService.register.
   */
  @IsOptional()
  @IsIn(SUPPORTED_UI_LOCALES)
  uiLanguage?: string;
}
