import { createHash, randomBytes } from 'crypto';
import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { isBookPubliclyEligible } from '../books/book-eligibility';
import { Fragment } from '../fragments/fragment.entity';
import { StorageService } from '../storage/storage.service';
import { ShareFragmentDto } from './dto/share-fragment.dto';
import { QuoteIntegrityService } from './quote-integrity.service';
import { resolveBackgroundImage } from './share-background';
import { cardKeyFromUrl } from './share-lifecycle.service';
import { SHARE_CREATE_LIMIT, ShareRateLimiter } from './share-rate-limiter';
import { Share } from './share.entity';

const SLUG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PG_UNIQUE_VIOLATION = '23505';

/** Short, URL-safe, unguessable slug for the /s/<id> invite link. */
function makeSlug(len = 10): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const e = err as QueryFailedError & { code?: string; driverError?: { code?: string } };
  return (e.code ?? e.driverError?.code) === PG_UNIQUE_VIOLATION;
}

export interface ShareResult {
  /** Public invite page — noetia.app/s/<id>. Used for "Copy link" + OG preview. */
  pageUrl: string;
  /** Direct PNG — used for Download and for posting to social platforms. */
  imageUrl: string;
  /** True when an identical live share already existed and was returned as-is. */
  reused: boolean;
}

/**
 * Identity of a rendered card: same creator + same fragment + same rendering
 * options ⇒ same share (NEM-016 G8). The background is hashed so a large
 * uploaded image doesn't bloat the key.
 */
export function shareConfigHash(
  userId: string,
  fragmentId: string,
  quote: string,
  dto: ShareFragmentDto,
  bgImage: string | undefined,
): string {
  return sha256(
    JSON.stringify({
      v: 1,
      userId,
      fragmentId,
      quote,
      platform: dto.platform,
      format: dto.format ?? null,
      font: dto.font ?? null,
      bgType: dto.bgType ?? null,
      bgColors: dto.bgColors ?? null,
      textColor: dto.textColor ?? null,
      citation: dto.citation ?? null,
      textBold: !!dto.textBold,
      textItalic: !!dto.textItalic,
      gradientDir: dto.gradientDir ?? null,
      bgImage: bgImage ? sha256(bgImage) : null,
      bgFlip: !!dto.bgFlip,
      bgFit: dto.bgFit ?? null,
      textAlign: dto.textAlign ?? null,
      textScale: dto.textScale ?? null,
    }),
  );
}

@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);
  private readonly imageGenUrl = process.env.IMAGE_GEN_URL ?? 'http://image-gen:5000';
  private readonly webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

  constructor(
    @InjectRepository(Share) private readonly shareRepo: Repository<Share>,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    private readonly quoteIntegrity: QuoteIntegrityService,
    private readonly rateLimiter: ShareRateLimiter,
    private readonly storage: StorageService,
  ) {}

  /**
   * Returns the caller's existing live share for this exact card, or renders a
   * new card and persists a public share snapshot. The caller (controller) has
   * already verified fragment ownership and book eligibility.
   */
  async createOrReuseShare(
    fragment: Fragment,
    book: Book,
    dto: ShareFragmentDto,
    userId: string,
  ): Promise<ShareResult> {
    const quote = dto.text ?? fragment.text;
    // C1 / D05: only the author's own wording may be rendered as a quotation.
    await this.quoteIntegrity.assertFaithfulExcerpt(book, quote);
    // S12: only inline images or Noetia preset backgrounds reach the renderer.
    const bgImage = resolveBackgroundImage(dto.bgImage);

    const configHash = shareConfigHash(userId, fragment.id, quote, dto, bgImage);
    const existing = await this.findLive(userId, configHash);
    if (existing) return this.toResult(existing, true);

    await this.rateLimiter.consume('share_create', userId, SHARE_CREATE_LIMIT);
    const imageUrl = await this.render(quote, book, dto, bgImage);

    const share = this.shareRepo.create({
      id: makeSlug(),
      bookId: book.id,
      fragmentId: fragment.id,
      quote,
      author: book.author,
      title: book.title,
      citation: dto.citation ?? null,
      imageUrl,
      platform: dto.platform,
      createdById: userId,
      configHash,
      revokedAt: null,
    });
    try {
      await this.shareRepo.save(share);
    } catch (err) {
      // A concurrent identical request won the race (partial unique index):
      // return its share and discard the image we just rendered.
      if (isUniqueViolation(err)) {
        const winner = await this.findLive(userId, configHash);
        if (winner) {
          await this.discardImage(imageUrl);
          return this.toResult(winner, true);
        }
      }
      throw err;
    }
    return this.toResult(share, false);
  }

  /**
   * Public data for the /s/<id> invite page. Revoked shares and shares of books
   * that are no longer public (unpublished / below the quality gate) are 404.
   */
  async getPublicShare(id: string) {
    const share = await this.shareRepo.findOneBy({ id });
    if (!share || share.revokedAt) throw new NotFoundException();
    if (!(await isBookPubliclyEligible(this.bookRepo, share.bookId))) throw new NotFoundException();

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

  private findLive(userId: string, configHash: string): Promise<Share | null> {
    return this.shareRepo.findOneBy({ createdById: userId, configHash, revokedAt: IsNull() });
  }

  private toResult(share: Share, reused: boolean): ShareResult {
    return { pageUrl: `${this.webUrl}/s/${share.id}`, imageUrl: share.imageUrl, reused };
  }

  private async render(
    quote: string,
    book: Book,
    dto: ShareFragmentDto,
    bgImage: string | undefined,
  ): Promise<string> {
    const response = await fetch(`${this.imageGenUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: quote,
        author: book.author,
        title: book.title,
        platform: dto.platform,
        ...(dto.format      && { format:      dto.format }),
        ...(dto.font        && { font:        dto.font }),
        ...(dto.bgType      && { bgType:      dto.bgType }),
        ...(dto.bgColors    && { bgColors:    dto.bgColors }),
        ...(dto.textColor   && { textColor:   dto.textColor }),
        ...(dto.citation    && { citation:    dto.citation }),
        ...(dto.textBold    && { textBold:    true }),
        ...(dto.textItalic  && { textItalic:  true }),
        ...(dto.gradientDir && { gradientDir: dto.gradientDir }),
        ...(bgImage         && { bgImage }),
        ...(dto.bgFlip      && { bgFlip:      true }),
        ...(dto.bgFit       && { bgFit:       dto.bgFit }),
        ...(dto.textAlign   && { textAlign:   dto.textAlign }),
        ...(dto.textScale   && { textScale:   dto.textScale }),
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException('image generation failed');
    }
    const data = (await response.json()) as { url: string };
    return data.url;
  }

  private async discardImage(imageUrl: string): Promise<void> {
    const key = cardKeyFromUrl(imageUrl);
    if (!key) return;
    await this.storage.delete('images', key).catch(() => {
      this.logger.warn(`orphan card image cleanup failed for key ${key}`);
    });
  }
}
