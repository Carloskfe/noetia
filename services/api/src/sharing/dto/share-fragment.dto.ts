import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BG_IMAGE_MAX_CHARS } from '../share-background';

/** Platforms the image-gen service can render (`whatsapp` kept for old clients). */
export const SHARE_PLATFORMS = ['linkedin', 'instagram', 'facebook', 'pinterest', 'whatsapp'] as const;
export const QUOTE_MAX_CHARS = 2000;
export const CITATION_MAX_CHARS = 200;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

/**
 * Body of POST /fragments/:id/share (NEM-016 S15). Enumerated rendering values
 * (format, font, bgType, gradientDir, bgFit) are length-capped here and fully
 * validated by image-gen, which owns those lists.
 */
export class ShareFragmentDto {
  @IsIn(SHARE_PLATFORMS)
  platform: (typeof SHARE_PLATFORMS)[number];

  @IsOptional() @IsString() @MaxLength(32)
  format?: string;

  @IsOptional() @IsString() @MaxLength(40)
  font?: string;

  @IsOptional() @IsIn(['solid', 'gradient', 'image'])
  bgType?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(4) @Matches(HEX_COLOR, { each: true })
  bgColors?: string[];

  @IsOptional() @Matches(HEX_COLOR)
  textColor?: string;

  /** Excerpt to render instead of the fragment text; must be faithful (C1). */
  @IsOptional() @IsString() @MaxLength(QUOTE_MAX_CHARS)
  text?: string;

  @IsOptional() @IsString() @MaxLength(CITATION_MAX_CHARS)
  citation?: string;

  @IsOptional() @IsBoolean()
  textBold?: boolean;

  @IsOptional() @IsBoolean()
  textItalic?: boolean;

  @IsOptional() @IsString() @MaxLength(32)
  gradientDir?: string;

  @IsOptional() @IsString() @MaxLength(BG_IMAGE_MAX_CHARS)
  bgImage?: string;

  @IsOptional() @IsBoolean()
  bgFlip?: boolean;

  @IsOptional() @IsIn(['cover', 'contain', 'blur'])
  bgFit?: string;

  @IsOptional() @IsIn(['left', 'center', 'right'])
  textAlign?: string;

  @IsOptional() @IsNumber() @Min(0.5) @Max(2)
  textScale?: number;
}
