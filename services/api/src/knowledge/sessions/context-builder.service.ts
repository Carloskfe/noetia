import { Injectable } from '@nestjs/common';
import { IntelligenceDenied } from '../common/intelligence-denied.error';
import { KnowledgeMetricsService } from '../common/knowledge-metrics.service';
import { MODEL_PATHS } from '../ai/model-paths';
import { ContextItem, sealContext, VerifiedContext } from '../ai/verified-context';

/**
 * Research-session Context Builder (ADR-006 source-scope isolation, B-3).
 *
 * Invariant `research_session_context`: the allowed set is explicit and
 * non-empty; every chunk, highlight, and note belongs to a book in it;
 * highlights and notes belong to the requesting user. Any violation aborts
 * the turn and increments intelligence_scope_violation_total.
 */
@Injectable()
export class ContextBuilderService {
  static readonly PATH = 'research_session.turn' as const;

  constructor(private readonly metrics: KnowledgeMetricsService) {}

  build(userId: string, allowedBookIds: readonly string[], items: readonly ContextItem[]): VerifiedContext {
    const allowed = new Set(allowedBookIds);
    const violation =
      allowed.size === 0 ||
      items.some(
        (i) =>
          !i.bookId ||
          !allowed.has(i.bookId) ||
          ((i.kind === 'highlight' || i.kind === 'note') && i.userId !== userId) ||
          !['chunk', 'highlight', 'note'].includes(i.kind),
      );
    if (violation) {
      this.metrics.scopeViolationInc();
      throw new IntelligenceDenied('scope_violation');
    }
    const path = MODEL_PATHS[ContextBuilderService.PATH];
    return sealContext({ pathId: ContextBuilderService.PATH, invariant: path.invariant, userId, allowedBookIds, items });
  }
}
