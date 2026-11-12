import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

/**
 * Request bodies accept ONLY book ids and a client idempotency key. Any
 * client-supplied limit, tier, budget, plan, rights, or ownership field is
 * stripped by the global whitelist ValidationPipe and never read (NEM-019 §10).
 * 10 is the database ceiling; the tier limit is enforced by the resolver.
 */
export class CreateSessionDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  bookIds?: string[];
}

export class AddBookDto {
  @IsUUID('all')
  bookId: string;
}

export class ForkSessionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  bookIds: string[];
}

export class TurnDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  idempotencyKey: string;

  /**
   * NEM-024 (D-3 A1): the research question. Required on the HTTP route. Transport bound only; the service applies
   * NFC normalization, trimming, and the 1–500 code-point rule (matching E5).
   */
  @IsString()
  @MaxLength(4000)
  question: string;
}

/** NEM-024 Checkpoint B: explicit cancellation names the turn by its client key (server-namespaced by user + session). */
export class CancelTurnDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  idempotencyKey: string;
}
