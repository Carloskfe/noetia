import { Inject, Injectable } from '@nestjs/common';
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from '../common/knowledge-config';
import { SEGMENT_ORIGINS } from '../knowledge.types';
import { MODEL_PATHS, ModelPathId } from './model-paths';
import { AnswerSegment } from './model-provider';
import { ModelRouterService } from './model-router.service';
import { isVerifiedContext, VerifiedContext } from './verified-context';

export interface GatewayResult {
  outcome: 'success' | 'failure' | 'timeout' | 'aborted';
  /** null = usage unknown → the reservation stays held. */
  unitsReported: number | null;
  provider: string;
  modelKey: string;
  segments: AnswerSegment[];
  /** A tool/planner argument or cited book fell outside the allowed set. */
  scopeViolation: boolean;
}

/**
 * Gateway (ADR-005/006). Accepts only a sealed context for a registered path
 * whose invariant matches; enforces a timeout; validates planner/tool
 * arguments and citations against the allowed set; never throws for provider
 * failures (it reports an outcome and, if unknown, null usage).
 */
@Injectable()
export class ModelGatewayService {
  constructor(
    private readonly router: ModelRouterService,
    @Inject(KNOWLEDGE_CONFIG) private readonly config: KnowledgeConfig,
  ) {}

  async invoke(pathId: ModelPathId, context: VerifiedContext): Promise<GatewayResult> {
    const path = MODEL_PATHS[pathId];
    if (!path || !isVerifiedContext(context) || context.pathId !== pathId || context.invariant !== path.invariant) {
      throw new Error('context invariant not satisfied for model path');
    }
    const provider = this.router.select(pathId);
    const base = { provider: provider.id, modelKey: provider.modelKey };

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.providerTimeoutMs);
    try {
      const res = await provider.invoke(context, controller.signal);
      const allowed = new Set(context.allowedBookIds);
      const badTool = res.toolCalls.some((t) => !allowed.has(t.bookId));
      const badSegment = res.segments.some(
        (s) => !SEGMENT_ORIGINS.includes(s.origin) || (s.bookId !== undefined && !allowed.has(s.bookId)),
      );
      const units = Number.isInteger(res.unitsReported) && (res.unitsReported as number) >= 0 ? res.unitsReported : null;
      const scopeViolation = badTool || badSegment;
      return {
        ...base,
        outcome: res.outcome,
        unitsReported: units,
        segments: scopeViolation ? [] : res.segments,
        scopeViolation,
      };
    } catch {
      return { ...base, outcome: timedOut ? 'timeout' : 'failure', unitsReported: null, segments: [], scopeViolation: false };
    } finally {
      clearTimeout(timer);
    }
  }
}
