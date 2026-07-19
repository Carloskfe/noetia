import { randomBytes } from 'crypto';
import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { Fragment } from '../fragments/fragment.entity';
import { Share } from './share.entity';

const SLUG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Short, URL-safe, unguessable slug for the /s/<id> invite link. */
function makeSlug(len = 10): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

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

export interface ShareResult {
  /** Public invite page — noetia.app/s/<id>. Used for "Copy link" + OG preview. */
  pageUrl: string;
  /** Direct PNG — used for Download and for posting to social platforms. */
  imageUrl: string;
}

@Injectable()
export class SharingService {
  private readonly imageGenUrl = process.env.IMAGE_GEN_URL ?? 'http://image-gen:5000';
  private readonly webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

  constructor(
    @InjectRepository(Share) private readonly shareRepo: Repository<Share>,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
  ) {}

  async generateShareUrl(
    fragment: Fragment,
    book: Book,
    platform: string,
    options: ShareOptions = {},
    createdById?: string,
  ): Promise<ShareResult> {
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
    const imageUrl = data.url;

    // Persist a public share so the invite page can render without the private
    // fragment. Snapshot the rendered quote/attribution + the image.
    const share = this.shareRepo.create({
      id: makeSlug(),
      bookId: book.id,
      fragmentId: fragment.id ?? null,
      quote: options.textOverride ?? fragment.text,
      author: book.author,
      title: book.title,
      citation: options.citation ?? null,
      imageUrl,
      platform: platform ?? null,
      createdById: createdById ?? null,
    });
    await this.shareRepo.save(share);

    return { pageUrl: `${this.webUrl}/s/${share.id}`, imageUrl };
  }

  /** Public data for the /s/<id> invite page. */
  async getPublicShare(id: string) {
    const share = await this.shareRepo.findOneBy({ id });
    if (!share) throw new NotFoundException();

    // Best-effort visit counter — never block the page render on it.
    this.shareRepo.increment({ id }, 'visitCount', 1).catch(() => {});

    const book = await this.bookRepo.findOneBy({ id: share.bookId });
    return {
      id: share.id,
      quote: share.quote,
      author: share.author,
      title: share.title,
      citation: share.citation,
      imageUrl: share.imageUrl,
      book: book
        ? {
            id: book.id,
            title: book.title,
            author: book.author,
            coverUrl: book.coverUrl,
            isFree: book.isFree,
          }
        : null,
    };
  }
}
