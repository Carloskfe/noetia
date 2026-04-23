import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import { BookCategory } from './book.entity';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';

const PRESIGN_TTL = 60 * 15; // 15 minutes

@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  findAll(@Query('category') category?: BookCategory) {
    return this.booksService.findAll(category);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const book = await this.booksService.findById(id);
    const textFileUrl = book.textFileKey
      ? await this.storageService.presign('books', book.textFileKey, PRESIGN_TTL)
      : null;
    const audioFileUrl = book.audioFileKey
      ? await this.storageService.presign('audio', book.audioFileKey, PRESIGN_TTL)
      : null;
    return { ...book, textFileUrl, audioFileUrl };
  }

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'textFile', maxCount: 1 },
        { name: 'audioFile', maxCount: 1 },
      ],
      { limits: { fileSize: 500 * 1024 * 1024 } },
    ),
  )
  async create(
    @Request() req: any,
    @Body() dto: CreateBookDto,
    @UploadedFiles()
    files: { textFile?: Express.Multer.File[]; audioFile?: Express.Multer.File[] },
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();

    let textFileKey: string | undefined;
    let audioFileKey: string | undefined;

    if (files.textFile?.[0]) {
      const f = files.textFile[0];
      textFileKey = `${uuidv4()}${extname(f.originalname)}`;
      await this.storageService.upload('books', textFileKey, f.buffer, f.mimetype);
    }

    if (files.audioFile?.[0]) {
      const f = files.audioFile[0];
      audioFileKey = `${uuidv4()}${extname(f.originalname)}`;
      await this.storageService.upload('audio', audioFileKey, f.buffer, f.mimetype);
    }

    return this.booksService.create(dto, textFileKey, audioFileKey);
  }
}
