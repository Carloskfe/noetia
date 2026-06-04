import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly repo: Repository<Event>,
  ) {}

  /**
   * Append an analytics event. Fire-and-forget — errors are logged but never
   * propagated so a DB hiccup cannot break the user-facing request.
   */
  async emit(
    eventType: string,
    userId: string | null,
    bookId: string | null,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.repo.save(this.repo.create({ eventType, userId, bookId, payload }));
    } catch (err: unknown) {
      this.logger.error(
        `Failed to emit event "${eventType}"`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
