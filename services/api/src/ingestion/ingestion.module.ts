import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { GutenbergFetcherService } from './gutenberg-fetcher.service';
import { WikisourceFetcherService } from './wikisource-fetcher.service';
import { PhraseSplitterService } from './phrase-splitter.service';
import { MinioUploaderService } from './minio-uploader.service';
import { LibrivoxApiService } from './librivox-api.service';
import { AudioDownloaderService } from './audio-downloader.service';
import { IngestionService } from './ingestion.service';
import { AlignmentService } from './alignment.service';

@Module({
  imports: [TypeOrmModule.forFeature([Book, SyncMap])],
  providers: [
    GutenbergFetcherService,
    WikisourceFetcherService,
    PhraseSplitterService,
    MinioUploaderService,
    LibrivoxApiService,
    AudioDownloaderService,
    IngestionService,
    AlignmentService,
  ],
  exports: [IngestionService, AlignmentService],
})
export class IngestionModule {}
