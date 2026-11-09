import { ContextItem } from '../ai/verified-context';

/**
 * Supplies candidate context for a turn. NEM-019 performs NO retrieval: the
 * default binding returns nothing; tests bind fixtures (including deliberate
 * scope violations) to prove the Context Builder invariant.
 */
export interface ContextSourcePort {
  candidates(userId: string, sessionId: string, allowedBookIds: readonly string[]): Promise<ContextItem[]>;
}

export const CONTEXT_SOURCE_PORT = Symbol('CONTEXT_SOURCE_PORT');

export class EmptyContextSource implements ContextSourcePort {
  async candidates(): Promise<ContextItem[]> {
    return [];
  }
}
