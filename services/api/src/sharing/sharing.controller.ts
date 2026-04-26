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

@Controller()
export class SharingController {
  constructor(
    private readonly sharingService: SharingService,
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
    @Request() req: { user: { id: string } },
  ) {
    const fragment = await this.fragmentRepo.findOneBy({ id });
    if (!fragment) throw new NotFoundException();

    const book = await this.bookRepo.findOneBy({ id: fragment.bookId });
    if (!book) throw new NotFoundException();

    const url = await this.sharingService.generateShareUrl(fragment, book, platform, {
      format, font, bgType, bgColors, textColor,
    });
    return { url };
  }
}
