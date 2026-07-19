import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionGuard } from '../subscriptions/subscription.guard';
import { StorageService } from '../storage/storage.service';
import { SearchService } from '../search/search.service';
import { UserType } from '../users/user.entity';
import { BookCategory } from './book.entity';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { SyncMapService } from './sync-map.service';
import { SyncPhrase } from './sync-map.entity';
import { SrtParserService } from './srt-parser.service';
import { ReadingProgressService } from './reading-progress.service';
import { FragmentsService } from '../fragments/fragments.service';
import { UploadCodesService } from '../codes/upload-codes.service';

const PRESIGN_TTL = 60 * 15; // 15 minutes

// Reader content endpoints are protected by JwtAuthGuard + SubscriptionGuard.
// Per-IP rate limiting is not appropriate here — legitimate readers in
// Modo Escucha Activa generate frequent progress saves from the same IP.
@SkipThrottle({ global: true })
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly storageService: StorageService,
    private readonly syncMapService: SyncMapService,
    private readonly srtParserService: SrtParserService,
    private readonly uploadCodesService: UploadCodesService,
    private readonly readingProgressService: ReadingProgressService,
    private readonly fragmentsService: FragmentsService,
    private readonly searchService: SearchService,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  findAll(
    @Query('category') category?: BookCategory,
    @Query('isFree') isFree?: string,
    @Query('includeCollections') includeCollections?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    const isFreeFilter =
      isFree === 'true' ? true : isFree === 'false' ? false : undefined;
    const standalone = includeCollections !== 'true';
    const parsedLimit = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 0, 0), 50)
      : undefined;
    return this.booksService.findAll(
      category,
      isFreeFilter,
      standalone,
      search,
      parsedLimit,
    );
  }

  // Must come before /:id to avoid "pending" being matched as an id
  @Get('pending')
  @UseGuards(JwtAuthGuard)
  async getPending(@Request() req: any) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    return this.booksService.findPending();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  async findOne(@Param('id') id: string) {
    const book = await this.booksService.findById(id);
    const textFileUrl = book.textFileKey
      ? await this.storageService.presign('books', book.textFileKey, PRESIGN_TTL)
      : null;
    const audioFileUrl = book.audioFileKey
      ? book.audioFileKey.startsWith('http')
        ? book.audioFileKey
        : await this.storageService.presign('audio', book.audioFileKey, PRESIGN_TTL)
      : null;
    const audioStreamUrl = book.audioStreamKey
      ? book.audioStreamKey.startsWith('http')
        ? book.audioStreamKey
        : await this.storageService.presign('audio', book.audioStreamKey, PRESIGN_TTL)
      : null;
    return { ...book, textFileUrl, audioFileUrl, audioStreamUrl };
  }

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'textFile', maxCount: 1 },
        { name: 'audioFile', maxCount: 1 },
        { name: 'coverFile', maxCount: 1 },
      ],
      { limits: { fileSize: 500 * 1024 * 1024 } },
    ),
  )
  async create(
    @Request() req: any,
    @Body() dto: CreateBookDto & { uploadCode?: string },
    @UploadedFiles()
    files: { textFile?: Express.Multer.File[]; audioFile?: Express.Multer.File[]; coverFile?: Express.Multer.File[] },
  ) {
    const { isAdmin, userType } = req.user;
    const canUpload =
      isAdmin ||
      userType === UserType.AUTHOR ||
      userType === UserType.EDITORIAL;
    if (!canUpload) throw new ForbiddenException();

    // Validate upload code BEFORE quota check — a valid code bypasses the quota
    const uploadCode = dto.uploadCode?.trim();
    if (uploadCode) {
      await this.uploadCodesService.validate(uploadCode); // throws if invalid/expired/used
    } else if (!isAdmin) {
      await this.booksService.checkUploadQuota(req.user.id);
    }

    let textFileKey: string | undefined;
    let audioFileKey: string | undefined;
    let textFileSizeBytes: number | undefined;
    let audioFileSizeBytes: number | undefined;

    if (files.textFile?.[0]) {
      const f = files.textFile[0];
      textFileKey = `${uuidv4()}${extname(f.originalname)}`;
      textFileSizeBytes = f.size;
      await this.storageService.upload('books', textFileKey, f.buffer, f.mimetype);
    }

    if (files.audioFile?.[0]) {
      const f = files.audioFile[0];
      audioFileKey = `${uuidv4()}${extname(f.originalname)}`;
      audioFileSizeBytes = f.size;
      await this.storageService.upload('audio', audioFileKey, f.buffer, f.mimetype);
    }

    // Cover file upload — stored in images bucket, returns a permanent public URL
    if (files.coverFile?.[0] && !dto.coverUrl) {
      const f = files.coverFile[0];
      const coverKey = `covers/${uuidv4()}${extname(f.originalname)}`;
      await this.storageService.upload('images', coverKey, f.buffer, f.mimetype);
      dto.coverUrl = this.storageService.publicUrl('images', coverKey);
    }

    // Admin uploads go live immediately; author/editorial submissions need review
    const book = await this.booksService.create(
      dto, textFileKey, audioFileKey, req.user.id, isAdmin, textFileSizeBytes, audioFileSizeBytes,
    );

    // Consume the code atomically after the book is saved — prevents burning a code on a failed upload
    if (uploadCode) {
      await this.uploadCodesService.consume(uploadCode, req.user.id);
    }

    if (book.isPublished) void this.searchService.indexBook(book);
    return book;
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard)
  async publish(@Param('id') id: string, @Request() req: any) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    const book = await this.booksService.publish(id);
    void this.searchService.indexBook(book);
    return book;
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Request() req: any) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    await this.booksService.remove(id);
    void this.searchService.removeBook(id);
  }

  // ── Fragments ─────────────────────────────────────────────────────────────

  @Get(':id/fragments')
  @UseGuards(JwtAuthGuard)
  getFragments(@Param('id') id: string, @Request() req: any) {
    return this.fragmentsService.findByUserAndBook(req.user.id, id);
  }

  // ── Sync Map ──────────────────────────────────────────────────────────────

  @Get(':id/sync-map')
  @Header('Cache-Control', 'private, max-age=3600, stale-while-revalidate=86400')
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  async getSyncMap(@Param('id') id: string) {
    const syncMap = await this.syncMapService.findByBook(id);
    if (!syncMap) throw new NotFoundException('Sync map not found');
    return syncMap;
  }

  @Post(':id/sync-map')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  async upsertSyncMap(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { phrases: SyncPhrase[] },
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    return this.syncMapService.upsert(id, body.phrases);
  }

  @Post(':id/sync-map/srt')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async upsertSyncMapFromSrt(
    @Param('id') id: string,
    @Request() req: any,
    @Req() rawReq: RawBodyRequest<ExpressRequest>,
  ) {
    const book = await this.booksService.findById(id);
    const isOwner = book.uploadedById === req.user.id;
    if (!req.user.isAdmin && !isOwner) throw new ForbiddenException();

    const body = rawReq.rawBody?.toString('utf8') ?? '';
    if (!body.trim()) throw new BadRequestException('SRT/VTT body must not be empty');
    if (Buffer.byteLength(body, 'utf8') > 2 * 1024 * 1024) {
      throw new BadRequestException('Body exceeds 2 MB limit');
    }

    const { phrases, source } = this.srtParserService.parse(body);
    if (!phrases.length) throw new BadRequestException('No valid cues found in the provided SRT/VTT');
    return this.syncMapService.upsert(id, phrases, source);
  }

  // ── Reading Progress ──────────────────────────────────────────────────────

  @Get(':id/progress')
  @UseGuards(JwtAuthGuard)
  async getProgress(@Param('id') id: string, @Request() req: any) {
    const progress = await this.readingProgressService.findByUserAndBook(req.user.id, id);
    if (!progress) return { phraseIndex: 0 };
    return progress;
  }

  @Post(':id/progress')
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  async saveProgress(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { phraseIndex: number },
  ) {
    const existing = await this.readingProgressService.findByUserAndBook(req.user.id, id);
    const result = await this.readingProgressService.upsert(req.user.id, id, body.phraseIndex);
    return { ...result, _status: existing ? 200 : 201 };
  }
}
