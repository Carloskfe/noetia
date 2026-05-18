import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { TokenLedger } from '../subscriptions/token-ledger.entity';
import { User } from '../users/user.entity';
import { GiftCard } from './gift-card.entity';
import { GiftsController } from './gifts.controller';
import { GiftsService } from './gifts.service';

@Module({
  imports: [TypeOrmModule.forFeature([GiftCard, TokenLedger, User]), EmailModule],
  providers: [GiftsService],
  controllers: [GiftsController],
  exports: [GiftsService],
})
export class GiftsModule {}
