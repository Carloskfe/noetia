import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from '../books/book.entity';
import { UserBook } from '../library/user-book.entity';
import { PushModule } from '../push/push.module';
import { Subscription } from '../subscriptions/subscription.entity';
import { ClubBook } from './club-book.entity';
import { ClubDiscussion } from './club-discussion.entity';
import { ClubMember } from './club-member.entity';
import { ClubMessage } from './club-message.entity';
import { ClubPoll, ClubPollOption, ClubPollVote } from './club-poll.entity';
import { ClubSession } from './club-session.entity';
import { Club } from './club.entity';
import { ClubBooksService } from './club-books.service';
import { ClubDiscussionsService } from './club-discussions.service';
import { ClubMembersService } from './club-members.service';
import { ClubMessagesService } from './club-messages.service';
import { ClubPollsService } from './club-polls.service';
import { ClubSessionsService } from './club-sessions.service';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
import { ClubRoleGuard } from './guards/club-role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Club, ClubMember, ClubBook, ClubMessage, ClubDiscussion,
      ClubPoll, ClubPollOption, ClubPollVote, ClubSession,
      Book, UserBook, Subscription,
    ]),
    JwtModule.register({}),
    PushModule,
  ],
  controllers: [ClubsController],
  providers: [
    ClubsService,
    ClubMembersService,
    ClubBooksService,
    ClubMessagesService,
    ClubDiscussionsService,
    ClubPollsService,
    ClubSessionsService,
    ClubRoleGuard,
  ],
  exports: [ClubsService],
})
export class ClubsModule {}
