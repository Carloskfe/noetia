import { Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CapabilityGuard, DeclareCapability } from '../entitlement/capability.guard';
import { RESEARCH_SESSION } from '../knowledge.types';
import { AddBookDto, CancelTurnDto, CreateSessionDto, ForkSessionDto, TurnDto } from './sessions.dto';
import { SessionsService } from './sessions.service';
import { TurnService } from './turn.service';
import { streamTurn } from './turn-stream';

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

  // NEM-024 Checkpoint C: capability probe. Static route declared BEFORE every `:id` route, so `ParseUUIDPipe` never
  // sees "capabilities". Deny-first through the CapabilityGuard (`use`); tier, capability keys, and limits only.
  @Get('capabilities')
  @DeclareCapability(RESEARCH_SESSION, 'use')
  capabilities(@Req() req: AuthedRequest) {
    return this.turns.capabilities(req.user.id);
  }

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

  // NEM-024 Checkpoint B: history and single-turn reads (owner only; expired provisional turns are finalized first;
  // source excerpts are re-validated against current eligibility).
  @Get(':id/turns')
  @DeclareCapability(RESEARCH_SESSION, 'history')
  history(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.turns.history(req.user.id, id, limit);
  }

  @Get(':id/turns/:turnId')
  @DeclareCapability(RESEARCH_SESSION, 'history')
  turnView(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('turnId', ParseUUIDPipe) turnId: string) {
    return this.turns.turnView(req.user.id, id, turnId);
  }

  // NEM-024 Checkpoint B: explicit, authenticated cancellation (a disconnect never cancels; D-9 a).
  @Post(':id/turns/cancel')
  @HttpCode(200)
  @DeclareCapability(RESEARCH_SESSION, 'use')
  cancel(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelTurnDto) {
    return this.turns.cancel(req.user.id, id, dto.idempotencyKey);
  }

  // NEM-024 Checkpoint C: SSE transport for the same turn (guards and pipes run first, so auth, capability, UUID, and
  // body errors stay ordinary HTTP errors; once the stream opens, every outcome is a `terminal` event). Closing the
  // connection never cancels the turn (D-9 a).
  @Post(':id/turns/stream')
  @DeclareCapability(RESEARCH_SESSION, 'use')
  async stream(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TurnDto, @Res() res: Response): Promise<void> {
    await streamTurn(res, (onStage) => this.turns.run(req.user.id, id, dto.idempotencyKey, dto.question, { onStage }));
  }

  @Post(':id/turns')
  @HttpCode(200)
  @DeclareCapability(RESEARCH_SESSION, 'use')
  turn(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TurnDto) {
    return this.turns.run(req.user.id, id, dto.idempotencyKey, dto.question);
  }
}
