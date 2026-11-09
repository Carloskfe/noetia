import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

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
}
