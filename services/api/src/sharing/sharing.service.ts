import { BadGatewayException, Injectable } from '@nestjs/common';
import { Book } from '../books/book.entity';
import { Fragment } from '../fragments/fragment.entity';

export interface ShareOptions {
  format?: string;
  font?: string;
  bgType?: string;
  bgColors?: string[];
  textColor?: string;
  textOverride?: string;
  citation?: string;
  textBold?: boolean;
  textItalic?: boolean;
  gradientDir?: string;
  bgImage?: string;
  bgFlip?: boolean;
  bgFit?: string;
  textAlign?: string;
  textScale?: number;
}

@Injectable()
export class SharingService {
  private readonly imageGenUrl = process.env.IMAGE_GEN_URL ?? 'http://image-gen:5000';

  async generateShareUrl(
    fragment: Fragment,
    book: Book,
    platform: string,
    options: ShareOptions = {},
  ): Promise<string> {
    const response = await fetch(`${this.imageGenUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: options.textOverride ?? fragment.text,
        author: book.author,
        title: book.title,
        platform,
        ...(options.format    && { format:    options.format }),
        ...(options.font      && { font:      options.font }),
        ...(options.bgType    && { bgType:    options.bgType }),
        ...(options.bgColors  && { bgColors:  options.bgColors }),
        ...(options.textColor && { textColor: options.textColor }),
        ...(options.citation    && { citation:    options.citation }),
        ...(options.textBold    && { textBold:    true }),
        ...(options.textItalic  && { textItalic:  true }),
        ...(options.gradientDir && { gradientDir: options.gradientDir }),
        ...(options.bgImage     && { bgImage:     options.bgImage }),
        ...(options.bgFlip      && { bgFlip:      true }),
        ...(options.bgFit       && { bgFit:       options.bgFit }),
        ...(options.textAlign   && { textAlign:   options.textAlign }),
        ...(options.textScale   && { textScale:   options.textScale }),
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException('image generation failed');
    }

    const data = (await response.json()) as { url: string };
    return data.url;
  }
}
