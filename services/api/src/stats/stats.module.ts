import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReadingStat } from './reading-stat.entity';
import { User } from '../users/user.entity';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReadingStat, User])],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
