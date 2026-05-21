import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubBooksService } from './club-books.service';
import { ClubDiscussionsService } from './club-discussions.service';
import { ClubMembersService } from './club-members.service';
import { ClubMessagesService } from './club-messages.service';
import { ClubPollsService } from './club-polls.service';
import { ClubSessionsService } from './club-sessions.service';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { CreateDiscussionDto } from './dto/create-discussion.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateClubDto } from './dto/update-club.dto';

@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  constructor(
    private readonly clubs: ClubsService,
    private readonly members: ClubMembersService,
    private readonly books: ClubBooksService,
    private readonly messages: ClubMessagesService,
    private readonly discussions: ClubDiscussionsService,
    private readonly polls: ClubPollsService,
    private readonly sessions: ClubSessionsService,
  ) {}

  // ── Club CRUD ────────────────────────────────────────────────────────────────

  @Post()
  create(@Request() req: any, @Body() dto: CreateClubDto) {
    return this.clubs.create(req.user.sub, dto);
  }

  @Get()
  @SkipThrottle()
  findAll(@Query() query: { search?: string; type?: string; bookId?: string; sort?: string; limit?: string; offset?: string }) {
    return this.clubs.findAll({ ...query, limit: query.limit ? +query.limit : undefined, offset: query.offset ? +query.offset : undefined });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clubs.findOne(id);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateClubDto) {
    return this.clubs.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.clubs.remove(req.user.sub, id);
  }

  // ── Members ──────────────────────────────────────────────────────────────────

  @Get(':id/members')
  listMembers(@Param('id') id: string) {
    return this.members.listMembers(id);
  }

  @Post(':id/join')
  join(@Request() req: any, @Param('id') id: string) {
    return this.members.join(req.user.sub, id);
  }

  @Delete(':id/members/me')
  leave(@Request() req: any, @Param('id') id: string) {
    return this.members.leave(req.user.sub, id);
  }

  @Post(':id/invite')
  generateInvite(@Request() req: any, @Param('id') id: string) {
    return this.members.generateInviteLink(req.user.sub, id);
  }

  @Post(':id/accept')
  acceptInvite(@Request() req: any, @Param('id') id: string, @Body('token') token: string) {
    return this.members.acceptInvite(req.user.sub, token);
  }

  @Patch(':id/members/:userId/role')
  updateRole(@Request() req: any, @Param('id') id: string, @Param('userId') userId: string, @Body('role') role: string) {
    return this.members.updateRole(req.user.sub, id, userId, role as any);
  }

  @Delete(':id/members/:userId')
  removeMember(@Request() req: any, @Param('id') id: string, @Param('userId') userId: string, @Body('ban') ban: boolean) {
    return this.members.removeMember(req.user.sub, id, userId, ban ?? false);
  }

  @Patch(':id/notifications')
  updateNotifications(@Request() req: any, @Param('id') id: string, @Body() prefs: any) {
    return this.members.updateNotificationPrefs(req.user.sub, id, prefs);
  }

  // ── Books ────────────────────────────────────────────────────────────────────

  @Get(':id/books')
  listBooks(@Param('id') id: string) {
    return this.books.findAll(id);
  }

  @Post(':id/books')
  addBook(@Request() req: any, @Param('id') id: string, @Body('bookId') bookId: string) {
    return this.books.addBook(req.user.sub, id, bookId);
  }

  @Patch(':id/books/:bookId/activate')
  activateBook(@Request() req: any, @Param('id') id: string, @Param('bookId') bookId: string) {
    return this.books.setActive(req.user.sub, id, bookId);
  }

  // ── General Chat ─────────────────────────────────────────────────────────────

  @Get(':id/messages')
  listMessages(@Request() req: any, @Param('id') id: string, @Query('before') before?: string) {
    return this.messages.findAll(req.user.sub, id, before);
  }

  @Post(':id/messages')
  postMessage(@Request() req: any, @Param('id') id: string, @Body() dto: CreateMessageDto) {
    return this.messages.create(req.user.sub, id, dto.content);
  }

  @Delete(':id/messages/:msgId')
  deleteMessage(@Request() req: any, @Param('id') id: string, @Param('msgId') msgId: string) {
    return this.messages.remove(req.user.sub, id, msgId);
  }

  // ── Book Discussions (phrase-anchored) ───────────────────────────────────────

  @Get(':id/discussions/:bookId')
  listDiscussions(
    @Request() req: any,
    @Param('id') id: string,
    @Param('bookId') bookId: string,
    @Query('phraseFrom') phraseFrom?: string,
    @Query('phraseTo') phraseTo?: string,
  ) {
    return this.discussions.findByBook(req.user.sub, id, bookId, phraseFrom ? +phraseFrom : undefined, phraseTo ? +phraseTo : undefined);
  }

  @Post(':id/discussions')
  postDiscussion(@Request() req: any, @Param('id') id: string, @Body() dto: CreateDiscussionDto) {
    return this.discussions.create(req.user.sub, id, dto.bookId, dto.phraseIndex, dto.content);
  }

  @Delete(':id/discussions/:discussionId')
  deleteDiscussion(@Request() req: any, @Param('id') id: string, @Param('discussionId') discussionId: string) {
    return this.discussions.remove(req.user.sub, id, discussionId);
  }

  // ── Polls ────────────────────────────────────────────────────────────────────

  @Get(':id/polls')
  listPolls(@Request() req: any, @Param('id') id: string) {
    return this.polls.findAll(req.user.sub, id);
  }

  @Post(':id/polls')
  createPoll(@Request() req: any, @Param('id') id: string, @Body() dto: CreatePollDto) {
    return this.polls.create(req.user.sub, id, dto);
  }

  @Post(':id/polls/:pollId/vote')
  vote(@Request() req: any, @Param('id') id: string, @Param('pollId') pollId: string, @Body('optionId') optionId: string) {
    return this.polls.vote(req.user.sub, id, pollId, optionId);
  }

  @Post(':id/polls/:pollId/close')
  closePoll(@Request() req: any, @Param('id') id: string, @Param('pollId') pollId: string) {
    return this.polls.close(req.user.sub, id, pollId);
  }

  // ── Escucha Juntos Sessions ──────────────────────────────────────────────────

  @Get(':id/sessions')
  listSessions(@Request() req: any, @Param('id') id: string) {
    return this.sessions.findAll(req.user.sub, id);
  }

  @Post(':id/sessions')
  createSession(@Request() req: any, @Param('id') id: string, @Body() dto: CreateSessionDto) {
    return this.sessions.create(req.user.sub, id, dto);
  }

  @Delete(':id/sessions/:sessionId')
  cancelSession(@Request() req: any, @Param('id') id: string, @Param('sessionId') sessionId: string) {
    return this.sessions.cancel(req.user.sub, id, sessionId);
  }
}
