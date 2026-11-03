import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ShareLifecycleModule } from '../sharing/share-lifecycle.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), EmailModule, ShareLifecycleModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
