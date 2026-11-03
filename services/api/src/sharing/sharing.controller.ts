import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Request,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fragment } from '../fragments/fragment.entity';
import { Book } from '../books/book.entity';
import { isBookPubliclyEligible } from '../books/book-eligibility';
import { SharingService } from './sharing.service';
import { ShareLifecycleService } from './share-lifecycle.service';
import { ShareFragmentDto } from './dto/share-fragment.dto';
import { EventsService } from '../events/events.service';

@Controller()
export class SharingController {
  constructor(
    private readonly sharingService: SharingService,
    private readonly lifecycle: ShareLifecycleService,
    private readonly events: EventsService,
    @InjectRepository(Fragment)
    private readonly fragmentRepo: Repository<Fragment>,
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
  ) {}

  @Post('fragments/:id/share')
  @UseGuards(JwtAuthGuard)
  async share(
    @Param('id') id: string,
    @Body() dto: ShareFragmentDto,
    @Request() req: { user: { id: string } },
  ) {
    // S1: only the fragment's owner may publish it. 404 (not 403) so fragment
    // ids belonging to other readers can't be probed.
    const fragment = await this.fragmentRepo.findOneBy({ id });
    if (!fragment || fragment.userId !== req.user.id) throw new NotFoundException();

    const book = await this.bookRepo.findOneBy({ id: fragment.bookId });
    if (!book) throw new NotFoundException();
    // S14: unpublished or quality-gated titles can't get public share pages.
    if (!(await isBookPubliclyEligible(this.bookRepo, book.id))) {
      throw new UnprocessableEntityException({ error: 'book_not_shareable' });
    }

    const { pageUrl, imageUrl, reused } = await this.sharingService.createOrReuseShare(
      fragment,
      book,
      dto,
      req.user.id,
    );

    // G8: count shares, not clicks — a re-used share isn't a new share.
    if (!reused) {
      await this.bookRepo.increment({ id: book.id }, 'shareCount', 1);
    }

    this.events.emit('fragment_shared', req.user.id, fragment.bookId, {
      fragmentId: fragment.id,
      platform: dto.platform,
      format: dto.format ?? null,
      themes: fragment.themes ?? [],
      reused,
    }).catch(() => {});

    // `url` is the public invite page (Copy link); `imageUrl` is the raw PNG
    // (Download + social publish).
    return { url: pageUrl, imageUrl };
  }

  /** Public — the /s/<id> invite page fetches this (no auth). */
  @Get('shares/:id')
  getShare(@Param('id') id: string) {
    return this.sharingService.getPublicShare(id);
  }

  /** Creator withdraws a share: the page stops resolving and the card image is removed (D07). */
  @Delete('shares/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async revoke(@Param('id') id: string, @Request() req: { user: { id: string } }): Promise<void> {
    await this.lifecycle.revoke(id, req.user.id);
  }
}
