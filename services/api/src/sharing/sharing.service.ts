import { BadGatewayException, Injectable } from '@nestjs/common';
import { Book } from '../books/book.entity';
import { Fragment } from '../fragments/fragment.entity';

export interface ShareOptions {
  format?: string;
  font?: string;
  bgType?: string;
  bgColors?: string[];
  textColor?: string;
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
        text: fragment.text,
        author: book.author,
        title: book.title,
        platform,
        ...(options.format     && { format:     options.format }),
        ...(options.font       && { font:       options.font }),
        ...(options.bgType     && { bgType:     options.bgType }),
        ...(options.bgColors   && { bgColors:   options.bgColors }),
        ...(options.textColor  && { textColor:  options.textColor }),
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException('image generation failed');
    }

    const data = (await response.json()) as { url: string };
    return data.url;
  }
}
