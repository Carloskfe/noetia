import { Inject, Injectable } from '@nestjs/common';
import { isRetryable, NormalizedUsage } from '../contract';
import { IntelligenceDenied } from '../../common/intelligence-denied.error';
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from '../../common/knowledge-config';
import { KnowledgeMetricsService } from '../../common/knowledge-metrics.service';
import { MAX_ATTEMPTS_PER_TURN } from '../../metering/attempt-key';
import { AttemptReservation, CostLedgerService } from '../../metering/cost-ledger.service';
import { MODEL_PATHS } from '../model-paths';
import { isVerifiedContext } from '../verified-context';
import { GatewayCondition, normalizeAttempt } from './attempt-normalizer';
import { CapabilityRouterService } from './capability-router.service';
import { enforceCitations, RawSegment } from './citation-policy';
import {
  AdapterEvent, AdapterRequest, AttemptRecord, AttemptSettlement, GatewayEvent, GatewayRequest, GatewayResponse, GatewaySegment,
  PromptEnvelope, ProviderAdapter, StopReason,
} from './gateway.types';
import { renderEnvelope } from './instruction-templates';
import { parseStructured } from './structured-output';

/** The request ends before any reservation (§5.2): no model serves it, or the context is too large. */
export class GatewayNotSent extends IntelligenceDenied {
  constructor(readonly error: 'capability_unavailable' | 'context_too_large') {
    super(error === 'context_too_large' ? 'invalid_request' : 'turn_failed');
  }
}

/** A negotiated, reserved first attempt. Used once: `invoke`/`stream`, or `release` if never sent. */
export interface PreparedCall {
  readonly request: GatewayRequest;
  readonly adapter: ProviderAdapter;
  readonly envelope: PromptEnvelope;
  readonly countedInputTokens: number;
  readonly nonTokenUnitBounds: Readonly<Record<string, number>>;
  readonly firstReservation: AttemptReservation;
  state: 'reserved' | 'released' | 'invoked';
}

interface AttemptResult {
  record: AttemptRecord;
  usage: NormalizedUsage;
  segments: GatewaySegment[];
  scopeViolation: boolean;
  structured?: unknown;
  /** The provider streamed output in this attempt (nothing reached the caller unless the attempt validated). */
  providerStreamed: boolean;
  stopReason: StopReason | null;
  refusalCategory: string | null;
  retryAfterMs: number | null;
}

const RESOLVED: readonly AttemptSettlement[] = ['settled', 'released', 'already_resolved'];
const ABORTED = Symbol('aborted');
const GRACE_EXPIRED: unique symbol = Symbol('grace-expired');

function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false);
    const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(true); }, ms);
    const onAbort = () => { clearTimeout(t); resolve(false); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * NEM-022 provider-independent Gateway (Gateway v2) on frozen contract v1.
 *
 * Order per call: negotiation → token count → per-attempt reservation (E1 `worstCaseCost`, via the cost ledger)
 * → provider call outside any transaction → normalized usage → settlement through the cost ledger, whose
 * `ledgerActionFor` decides settle / hold / release. The Gateway never calls a provider without a confirmed
 * reservation for that attempt, and each retry is a new attempt with its own reservation (D15).
 *
 * Dark: registered only inside KnowledgeModule (off by default). Simulated adapters only.
 */
@Injectable()
export class AiGatewayService {
  constructor(
    private readonly router: CapabilityRouterService,
    private readonly costLedger: CostLedgerService,
    private readonly metrics: KnowledgeMetricsService,
    @Inject(KNOWLEDGE_CONFIG) private readonly config: KnowledgeConfig,
  ) {}

  /** Negotiate, count, and reserve attempt 1. Throws GatewayNotSent or the ledger's AttemptDenied. */
  async prepare(request: GatewayRequest): Promise<PreparedCall> {
    const path = MODEL_PATHS[request.pathId];
    const ctx = request.context;
    if (!path || !isVerifiedContext(ctx) || ctx.pathId !== request.pathId || ctx.invariant !== path.invariant) {
      throw new Error('context invariant not satisfied for model path');
    }
    // F-2: the sealed context must belong to the user whose budget pays for the call. Checked before negotiation,
    // reservation, or any provider call; a mismatch is a scope violation (ADR-006 source-scope isolation).
    if (ctx.userId !== request.budget.userId) {
      this.metrics.scopeViolationInc();
      throw new IntelligenceDenied('scope_violation');
    }
    const envelope = renderEnvelope(request.templateId, ctx);
    const n = this.router.negotiate(request, envelope);
    if (!n.ok) {
      if (n.error === 'capability_unavailable') this.metrics.capabilityUnavailableInc();
      this.metrics.gatewayOutcomeInc('not_sent');
      throw new GatewayNotSent(n.error);
    }
    const nonTokenUnitBounds: Record<string, number> = {};
    for (const unit of n.adapter.descriptor.nonTokenUnits) nonTokenUnitBounds[unit] = request.nonTokenUnitBounds?.[unit] ?? 0;
    const firstReservation = await this.reserve(request, n.adapter, n.countedInputTokens, nonTokenUnitBounds, 1);
    return { request, adapter: n.adapter, envelope, countedInputTokens: n.countedInputTokens, nonTokenUnitBounds, firstReservation, state: 'reserved' };
  }

  /** Release a prepared attempt whose provider call was never made (e.g. the caller's lock failed). */
  async release(prepared: PreparedCall): Promise<void> {
    if (prepared.state !== 'reserved') return;
    prepared.state = 'released';
    await this.costLedger.releaseAttempt(prepared.firstReservation.attemptKey);
  }

  /** Run the call and collect the terminal response. */
  async invoke(prepared: PreparedCall, opts: { signal?: AbortSignal } = {}): Promise<GatewayResponse> {
    let response: GatewayResponse | undefined;
    for await (const e of this.stream(prepared, opts)) if (e.type === 'terminal') response = e.response;
    if (!response) throw new Error('gateway stream ended without a terminal event');
    return response;
  }

  /**
   * Streaming contract (§5.4), fail closed (review F-1): per attempt, validated deltas and segments → usage; then one
   * terminal event. Deltas are released only after the attempt's citations, origins, and tool scope are validated,
   * so incremental delivery is per attempt rather than per provider token (the documented tradeoff).
   */
  async *stream(prepared: PreparedCall, opts: { signal?: AbortSignal } = {}): AsyncGenerator<GatewayEvent> {
    if (prepared.state !== 'reserved') throw new Error('prepared call already used');
    prepared.state = 'invoked';
    const maxAttempts = Math.min(Math.max(this.config.maxProviderAttempts ?? 1, 1), MAX_ATTEMPTS_PER_TURN);
    const maxRetryDelay = this.config.maxRetryDelayMs ?? 0;
    const attempts: AttemptRecord[] = [];
    let reservation = prepared.firstReservation;
    let last: AttemptResult;
    for (let n = 1; ; n++) {
      last = yield* this.runAttempt(prepared, reservation, opts.signal);
      attempts.push(last.record);
      yield { type: 'usage', attempt: last.record, usage: last.usage };
      if (n >= maxAttempts || !isRetryable(last.usage.error) || last.providerStreamed || opts.signal?.aborted) break;
      const wait = last.usage.error === 'rate_limited' ? (last.retryAfterMs ?? 0) : (this.config.retryBackoffMs ?? 0);
      if (wait > maxRetryDelay) break;
      yield { type: 'retry', attemptNumber: n + 1, afterMs: wait };
      this.metrics.gatewayRetryInc();
      if (wait > 0 && !(await sleep(wait, opts.signal))) break;
      try {
        reservation = await this.reserve(prepared.request, prepared.adapter, prepared.countedInputTokens, prepared.nonTokenUnitBounds, n + 1);
      } catch {
        break; // the retry is not admitted; the last attempt stands (and is already settled or held)
      }
    }
    const response = this.response(last, attempts, prepared);
    this.metrics.gatewayOutcomeInc(response.outcome);
    if (response.scopeViolation) this.metrics.scopeViolationInc();
    yield { type: 'terminal', response };
  }

  // ── Internals ──────────────────────────────────────────────────────────────────────────────

  private reserve(req: GatewayRequest, adapter: ProviderAdapter, counted: number, bounds: Record<string, number>, attemptNumber: number) {
    return this.costLedger.reserveAttempt({
      userId: req.budget.userId,
      tier: req.budget.tier,
      capability: req.budget.capability,
      sessionId: req.budget.sessionId,
      turnKey: req.turnKey,
      attemptNumber,
      descriptor: adapter.descriptor,
      countedInputTokens: counted,
      maxOutputTokens: req.maxOutputTokens,
      cacheIntent: req.cacheIntent,
      nonTokenUnitBounds: bounds,
    });
  }

  private async *runAttempt(p: PreparedCall, res: AttemptReservation, external?: AbortSignal): AsyncGenerator<GatewayEvent, AttemptResult> {
    const startedAt = new Date().toISOString();
    const raw: RawSegment[] = [];
    const toolCalls: { name: string; bookId: string }[] = [];
    let final: Extract<AdapterEvent, { type: 'final' }> | undefined;
    /** F-1: every delta is buffered per segment and released only after the attempt has been validated. */
    const chunks: string[][] = [];
    let providerStreamed = false;
    let condition: GatewayCondition | undefined;

    if (external?.aborted) {
      // Never sent: release this attempt's reservation (no provider was called).
      let settlement: AttemptSettlement;
      try { settlement = await this.costLedger.releaseAttempt(res.attemptKey); } catch { settlement = 'ledger_error'; }
      const { usage } = normalizeAttempt({ descriptor: p.adapter.descriptor, attemptKey: res.attemptKey, startedAt, endedAt: startedAt, condition: 'client_abort' });
      return this.result(res, usage, settlement, [], false, undefined, false, final);
    }

    const ctrl = new AbortController();
    const onExternal = () => { condition ??= 'client_abort'; ctrl.abort(); };
    external?.addEventListener('abort', onExternal, { once: true });
    const timer = setTimeout(() => { condition ??= 'timeout'; ctrl.abort(); }, this.config.providerTimeoutMs);
    const aborted = new Promise<typeof ABORTED>((resolve) => ctrl.signal.addEventListener('abort', () => resolve(ABORTED), { once: true }));
    const request: AdapterRequest = {
      attemptKey: res.attemptKey, envelope: p.envelope, maxOutputTokens: p.request.maxOutputTokens,
      cacheIntent: p.request.cacheIntent, output: p.request.output, nonTokenUnitBounds: p.nonTokenUnitBounds,
    };
    try {
      const it = p.adapter.invoke(request, ctrl.signal)[Symbol.asyncIterator]();
      let pending = it.next();
      for (;;) {
        const r = await Promise.race([pending, aborted]);
        if (r === ABORTED) {
          // Give the adapter a short grace to report its partial usage, then stop it.
          const grace = sleep(this.config.abortGraceMs ?? 100).then((): typeof GRACE_EXPIRED => GRACE_EXPIRED);
          const late = await Promise.race([pending, grace]).catch((): typeof GRACE_EXPIRED => GRACE_EXPIRED);
          if (typeof late !== 'symbol' && !late.done && late.value.type === 'final') final = late.value;
          void Promise.resolve(it.return?.()).catch(() => undefined);
          break;
        }
        if (r.done) break;
        const ev = r.value;
        if (final) { pending = it.next(); continue; } // events after the final record are ignored (contract violation)
        if (ev.type === 'delta') {
          while (raw.length <= ev.segment) raw.push({ origin: ev.origin, text: '', citations: [] });
          raw[ev.segment].origin = ev.origin;
          raw[ev.segment].text += ev.text;
          (chunks[ev.segment] ??= []).push(ev.text);
          providerStreamed = true; // buffered, not yielded: see the release step below
        } else if (ev.type === 'citation') {
          while (raw.length <= ev.segment) raw.push({ origin: 'synthesis', text: '', citations: [] });
          raw[ev.segment].citations.push(ev.anchor === undefined ? { ref: ev.ref } : { ref: ev.ref, anchor: ev.anchor });
        } else if (ev.type === 'tool_call') {
          toolCalls.push({ name: ev.name, bookId: ev.bookId });
        } else if (ev.type === 'final') {
          final = ev;
        }
        pending = it.next();
      }
    } catch {
      condition ??= 'adapter_failure';
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternal);
      // Always stop the provider call when the attempt's read loop ends (completion, timeout, abort, or error).
      ctrl.abort();
    }
    if (!condition && !final) condition = 'adapter_failure';

    // Structured output: validate the completed answer; callers never see an unvalidated object.
    let structured: unknown;
    let structuredInvalid = false;
    if (p.request.output.mode === 'structured' && !condition && final?.usage?.outcome === 'completed' && final.usage.error === null) {
      const parsed = parseStructured(raw.map((s) => s.text).join(''), p.request.output.schema);
      if (parsed.ok) structured = parsed.value;
      else structuredInvalid = true;
    }
    const { usage } = normalizeAttempt({
      descriptor: p.adapter.descriptor, attemptKey: res.attemptKey, startedAt, endedAt: new Date().toISOString(),
      adapterUsage: final?.usage, condition, structuredInvalid,
    });

    // Citations, origins, and tool scope (§5.6), over the WHOLE attempt: a citation or tool call can arrive at any
    // point until the final event, so no text is released before this check. Only answers from completed or refused
    // attempts are released; structured output is never streamed (the validated object is in the terminal response).
    const answered = usage.outcome === 'completed' || usage.outcome === 'refused';
    const cite = enforceCitations(p.request.context, answered ? raw : [], toolCalls);
    const release = answered && !cite.scopeViolation && p.request.output.mode === 'text';

    // Settlement on the terminal event — BEFORE any consumer-visible yield (review F-3). An async generator suspends
    // at each yield, so a consumer that stops reading after the first delta would otherwise skip settlement and leave a
    // completed provider attempt unresolved. A ledger failure leaves the attempt held for reconciliation.
    let settlement: AttemptSettlement;
    try { settlement = await this.costLedger.settleAttempt(usage); } catch { settlement = 'ledger_error'; }

    if (release) {
      // F-1 release (fail closed): the buffered deltas, in their original chunks and order, then each segment's
      // validated origin and citations. Nothing reaches the caller from an attempt that failed validation.
      for (let i = 0; i < cite.segments.length; i++) {
        for (const text of chunks[i] ?? []) yield { type: 'delta', segment: i, text };
        yield { type: 'segment', segment: i, origin: cite.segments[i].origin, citations: cite.segments[i].citations };
      }
    }
    const segments = release ? cite.segments : [];
    return this.result(res, usage, settlement, segments, cite.scopeViolation, structured, providerStreamed, final);
  }

  private result(
    res: AttemptReservation, usage: NormalizedUsage, settlement: AttemptSettlement, segments: GatewaySegment[], scopeViolation: boolean,
    structured: unknown, providerStreamed: boolean, final: Extract<AdapterEvent, { type: 'final' }> | undefined,
  ): AttemptResult {
    return {
      record: { attemptNumber: res.attemptNumber, attemptKey: res.attemptKey, outcome: usage.outcome, error: usage.error, usageCompleteness: usage.usageCompleteness, settlement },
      usage, segments, scopeViolation, structured, providerStreamed,
      stopReason: final?.stopReason ?? (usage.error === null ? 'end_turn' : 'error'),
      refusalCategory: usage.error === 'refusal' ? final?.refusalCategory ?? null : null,
      retryAfterMs: final?.retryAfterMs ?? null,
    };
  }

  private response(last: AttemptResult, attempts: AttemptRecord[], p: PreparedCall): GatewayResponse {
    const segments = last.scopeViolation ? [] : last.segments;
    const response: GatewayResponse = {
      outcome: last.usage.outcome,
      error: last.usage.error,
      stopReason: last.stopReason,
      refusalCategory: last.refusalCategory,
      segments,
      scopeViolation: last.scopeViolation,
      usage: last.usage,
      attempts,
      settlement: attempts.every((a) => RESOLVED.includes(a.settlement)) ? 'settled' : 'held',
      counts: {
        segments: segments.length,
        librarySegments: segments.filter((s) => s.origin === 'library').length,
        citedItems: new Set(segments.flatMap((s) => s.citations.map((c) => c.ref))).size,
        outputTokens: last.usage.tokens.output,
      },
    };
    if (last.structured !== undefined && p.request.output.mode === 'structured' && !last.scopeViolation) response.structured = last.structured;
    return response;
  }
}
