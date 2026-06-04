import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fragment } from './fragment.entity';
import { FragmentsService } from './fragments.service';
import { FragmentsController } from './fragments.controller';
import { FragmentTaggerService } from './fragment-tagger.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Fragment]), EventsModule],
  controllers: [FragmentsController],
  providers: [FragmentsService, FragmentTaggerService],
  exports: [FragmentsService],
})
export class FragmentsModule {}
