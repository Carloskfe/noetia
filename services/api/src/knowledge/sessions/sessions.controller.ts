import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CapabilityGuard, DeclareCapability } from '../entitlement/capability.guard';
import { RESEARCH_SESSION } from '../knowledge.types';
import { AddBookDto, CreateSessionDto, ForkSessionDto, TurnDto } from './sessions.dto';
import { SessionsService } from './sessions.service';
import { TurnService } from './turn.service';

type AuthedRequest = { user: { id: string } };

/**
 * Research-session routes. Dark: only registered when KNOWLEDGE_MODULE_ENABLED
 * is 'true'. Every route needs JwtAuthGuard and a declared capability (§10).
 */
@Controller('knowledge/sessions')
@UseGuards(JwtAuthGuard, CapabilityGuard)
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly turns: TurnService,
  ) {}

  @Post()
  @DeclareCapability(RESEARCH_SESSION, 'use')
  create(@Req() req: AuthedRequest, @Body() dto: CreateSessionDto) {
    return this.sessions.create(req.user.id, dto.bookIds ?? []);
  }

  @Get(':id')
  @DeclareCapability(RESEARCH_SESSION, 'history')
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.get(req.user.id, id);
  }

  @Post(':id/books')
  @DeclareCapability(RESEARCH_SESSION, 'use')
  addBook(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddBookDto) {
    return this.sessions.addBook(req.user.id, id, dto.bookId);
  }

  @Delete(':id/books/:bookId')
  @DeclareCapability(RESEARCH_SESSION, 'use')
  removeBook(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bookId', ParseUUIDPipe) bookId: string,
  ) {
    return this.sessions.removeBook(req.user.id, id, bookId);
  }

  @Post(':id/fork')
  @DeclareCapability(RESEARCH_SESSION, 'use')
  fork(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ForkSessionDto) {
    return this.sessions.fork(req.user.id, id, dto.bookIds);
  }

  @Post(':id/turns')
  @HttpCode(200)
  @DeclareCapability(RESEARCH_SESSION, 'use')
  turn(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TurnDto) {
    return this.turns.run(req.user.id, id, dto.idempotencyKey, dto.question);
  }
}
