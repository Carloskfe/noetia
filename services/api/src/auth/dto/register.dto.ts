import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
/**
 * Languages an explicit local registration may carry (NEM-025 B2-A2a, F-B2A2a-1): `es` and `en` only.
 * `fr-CA` is rejected even when FR_CA_ENABLED=true; French registration belongs to French activation.
 */
export const REGISTRATION_UI_LOCALES = ['es', 'en'] as const;
export type RegistrationUiLocale = (typeof REGISTRATION_UI_LOCALES)[number];

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
   * register in Spanish. Only `es` and `en`; `fr-CA` is rejected even when FR_CA_ENABLED=true.
   */
  @IsOptional()
  @IsIn(REGISTRATION_UI_LOCALES)
  uiLanguage?: string;
}
