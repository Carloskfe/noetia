import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fragment } from '../fragments/fragment.entity';
import { Book } from '../books/book.entity';
import { SharingService } from './sharing.service';
import { EventsService } from '../events/events.service';

@Controller()
export class SharingController {
  constructor(
    private readonly sharingService: SharingService,
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
    @Body('platform') platform: string,
    @Body('format') format: string | undefined,
    @Body('font') font: string | undefined,
    @Body('bgType') bgType: string | undefined,
    @Body('bgColors') bgColors: string[] | undefined,
    @Body('textColor') textColor: string | undefined,
    @Body('text') textOverride: string | undefined,
    @Body('citation') citation: string | undefined,
    @Body('textBold') textBold: boolean | undefined,
    @Body('textItalic') textItalic: boolean | undefined,
    @Body('gradientDir') gradientDir: string | undefined,
    @Body('bgImage') bgImage: string | undefined,
    @Body('bgFlip') bgFlip: boolean | undefined,
    @Body('textAlign') textAlign: string | undefined,
    @Request() req: { user: { id: string } },
  ) {
    const fragment = await this.fragmentRepo.findOneBy({ id });
    if (!fragment) throw new NotFoundException();

    const book = await this.bookRepo.findOneBy({ id: fragment.bookId });
    if (!book) throw new NotFoundException();

    const url = await this.sharingService.generateShareUrl(fragment, book, platform, {
      format, font, bgType, bgColors, textColor, textOverride, citation,
      textBold, textItalic, gradientDir, bgImage, bgFlip, textAlign,
    });

    book.shareCount = (book.shareCount ?? 0) + 1;
    await this.bookRepo.save(book);

    this.events.emit('fragment_shared', req.user.id, fragment.bookId, {
      fragmentId: fragment.id,
      platform,
      format: format ?? null,
      themes: fragment.themes ?? [],
    }).catch(() => {});

    return { url };
  }
}
