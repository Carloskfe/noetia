import { createHash } from 'crypto';
import {
  AttemptOutcome, ErrorCategory, NormalizedUsage, SCHEMA_VERSION, TokenCounts, UsageCompleteness, ValidatedCapabilityDescriptor,
  ZeroUsageEvidence,
} from '../contract';
import { SegmentOrigin } from '../../knowledge.types';
import {
  AdapterEvent, AdapterRequest, OutputMode, PromptEnvelope, ProviderAdapter, StopReason,
} from '../gateway/gateway.types';
import { serializeBlock } from '../gateway/instruction-templates';

/** A scripted segment: origin, text, and the context refs it cites. */
export interface SimSegment {
  origin: SegmentOrigin;
  text: string;
  cite?: string[];
}

type Evidence = Exclude<ZeroUsageEvidence, never>;

/** One scripted provider behaviour (consumed per call; the default is `success`). */
export type SimStep =
  | {
      kind: 'success';
      segments?: SimSegment[];
      structured?: unknown;
      toolCalls?: { name: string; bookId: string }[];
      /** Explicit output tokens. Unclamped: a value above `maxOutputTokens` models a provider ignoring the bound. */
      outputTokens?: number;
      reasoningTokens?: number;
    }
  | { kind: 'refusal'; category: string; completeness: 'complete' | 'partial' }
  | { kind: 'reject'; error: 'invalid_request' | 'context_too_large' | 'rate_limited'; evidence: Evidence; retryAfterMs?: number }
  | { kind: 'unavailable'; evidence?: 'provider_reported_zero' | 'none' }
  | { kind: 'timeout' }
  | { kind: 'partial_stream'; deltas: number; then: 'hang' | 'drop' }
  | { kind: 'malformed' }
  | { kind: 'citation_error' }
  | { kind: 'internal' };

/** A directive the simulator obeys ONLY from the instructions channel (proves context cannot inject it). */
export const SIMULATOR_REFUSE_DIRECTIVE = 'SIMULATOR-DIRECTIVE:REFUSE';

const CHARS_PER_TOKEN = 4;
/** Fixed per-request framing tokens that are never cacheable (documented approximation). */
export const REQUEST_FRAMING_TOKENS = 16;
const DELTA_CHARS = 24;

/** Deterministic token estimate: ceil(UTF-8 bytes / 4), integer arithmetic only. */
export function simulatedTokenCount(text: string): number {
  const bytes = Buffer.byteLength(text, 'utf8');
  return (bytes + CHARS_PER_TOKEN - 1 - ((bytes + CHARS_PER_TOKEN - 1) % CHARS_PER_TOKEN)) / CHARS_PER_TOKEN;
}

function lifetimeMs(lifetime: string): number {
  const m = /^(\d+)([mh])$/.exec(lifetime);
  if (!m) throw new Error('invalid cache lifetime');
  return Number(m[1]) * (m[2] === 'h' ? 3_600_000 : 60_000);
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => (signal.aborted ? resolve() : signal.addEventListener('abort', () => resolve(), { once: true })));
}

/**
 * Simulator v2 (NEM-022 §5.7): a deterministic provider adapter. No SDK, network, or spend.
 *
 * - Scripted by seed and fixture (`enqueue`); the same seed, script, request, and clock give identical output and usage.
 * - Token counting: a documented approximation (`simulatedTokenCount`), declared `estimated` in its descriptor.
 * - Prompt-prefix caching: the instructions plus context blocks form the prefix; with a cache intent (or automatic
 *   writes) the first call writes the prefix for the lifetime and later calls read it until it expires.
 * - Whole-request tiers come from the E1 pricing fixtures (the simulator only reports counts).
 * - Emits contract-v1 usage records only.
 */
export class SimulatorV2Adapter implements ProviderAdapter {
  readonly simulated = true;
  private readonly script: SimStep[] = [];
  private readonly cache = new Map<string, number>();
  /** Test hook, awaited before responding (e.g. to race a downgrade). */
  beforeRespond?: () => Promise<void>;

  constructor(
    readonly descriptor: ValidatedCapabilityDescriptor,
    private readonly opts: { seed?: string; clock?: () => Date } = {},
  ) {}

  enqueue(...steps: SimStep[]) {
    this.script.push(...steps);
  }

  private now(): Date {
    return this.opts.clock ? this.opts.clock() : new Date();
  }

  private prefixTokens(envelope: PromptEnvelope): number {
    return simulatedTokenCount(envelope.instructions) + envelope.contextBlocks.reduce((n, b) => n + simulatedTokenCount(serializeBlock(b)), 0);
  }

  countTokens(envelope: PromptEnvelope, output: OutputMode): number {
    const schema = output.mode === 'structured' ? simulatedTokenCount(JSON.stringify(output.schema)) : 0;
    return this.prefixTokens(envelope) + REQUEST_FRAMING_TOKENS + schema;
  }

  private hash(...parts: string[]): string {
    return createHash('sha256').update([this.opts.seed ?? 'noetia-sim-v2', ...parts].join('\u0000')).digest('hex');
  }

  /** Input classes for this call, applying the prompt-prefix cache. */
  private inputTokens(req: AdapterRequest): TokenCounts {
    const total = this.countTokens(req.envelope, req.output);
    const { cacheHints } = this.descriptor.features;
    const lifetime = req.cacheIntent.mode !== 'none' ? req.cacheIntent.lifetime : cacheHints.automaticWrites ? cacheHints.lifetimes[0] : null;
    if (!lifetime) return { inputUncached: total, cacheRead: 0, cacheWrite: {}, output: 0 };
    const prefix = this.prefixTokens(req.envelope);
    const key = `${this.hash(req.envelope.instructions, ...req.envelope.contextBlocks.map(serializeBlock))}|${lifetime}`;
    const nowMs = this.now().getTime();
    const expires = this.cache.get(key);
    if (expires !== undefined && expires > nowMs) return { inputUncached: total - prefix, cacheRead: prefix, cacheWrite: {}, output: 0 };
    this.cache.set(key, nowMs + lifetimeMs(lifetime));
    return { inputUncached: total - prefix, cacheRead: 0, cacheWrite: { [lifetime]: prefix }, output: 0 };
  }

  private usage(
    req: AdapterRequest, startedAt: string, outcome: AttemptOutcome, error: ErrorCategory | null,
    completeness: UsageCompleteness, evidence: ZeroUsageEvidence, tokens: TokenCounts, toolCalls = 0,
  ): NormalizedUsage {
    const nonTokenUnits: Record<string, number> = {};
    for (const u of this.descriptor.nonTokenUnits) nonTokenUnits[u] = u === 'tool_call' ? toolCalls : 0;
    return {
      contract: 'noetia.ai.usage', schemaVersion: SCHEMA_VERSION, providerKey: this.descriptor.providerKey, modelKey: this.descriptor.modelKey,
      attemptKey: req.attemptKey, startedAt, endedAt: this.now().toISOString(), tokens, nonTokenUnits, outcome, error,
      usageCompleteness: completeness, zeroUsageEvidence: evidence,
    };
  }

  private defaultSegments(req: AdapterRequest): SimSegment[] {
    const firstChunk = new Map<string, string>();
    for (const b of req.envelope.contextBlocks) if (b.kind === 'chunk' && b.bookId && !firstChunk.has(b.bookId)) firstChunk.set(b.bookId, b.ref);
    const segs: SimSegment[] = [...firstChunk.values()].map((ref) => ({ origin: 'library', text: `Simulated analysis ${this.hash(ref).slice(0, 8)}.`, cite: [ref] }));
    segs.push({ origin: 'synthesis', text: `Simulated synthesis ${this.hash(req.envelope.templateId, String(req.envelope.contextBlocks.length)).slice(0, 8)}.` });
    return segs;
  }

  async *invoke(req: AdapterRequest, signal: AbortSignal): AsyncGenerator<AdapterEvent> {
    const directed = req.envelope.instructions.includes(SIMULATOR_REFUSE_DIRECTIVE);
    const step: SimStep = directed ? { kind: 'refusal', category: 'policy', completeness: 'complete' } : this.script.shift() ?? { kind: 'success' };
    if (this.beforeRespond) await this.beforeRespond();
    const startedAt = this.now().toISOString();
    const zero: TokenCounts = { inputUncached: 0, cacheRead: 0, cacheWrite: {}, output: 0 };

    switch (step.kind) {
      case 'internal':
        throw new Error('simulated internal error');
      case 'reject': {
        const evidenced = step.evidence !== 'none';
        yield {
          type: 'final', usage: this.usage(req, startedAt, 'rejected', step.error, evidenced ? 'zero_confirmed' : 'unknown', step.evidence, zero),
          stopReason: 'error', retryAfterMs: step.retryAfterMs,
        };
        return;
      }
      case 'unavailable': {
        const evidenced = step.evidence === 'provider_reported_zero';
        yield { type: 'final', usage: this.usage(req, startedAt, 'failed', 'provider_unavailable', evidenced ? 'zero_confirmed' : 'unknown', evidenced ? 'provider_reported_zero' : 'none', zero), stopReason: 'error' };
        return;
      }
      case 'timeout':
        await waitForAbort(signal);
        yield { type: 'final', usage: this.usage(req, startedAt, 'aborted', 'client_abort', 'unknown', 'none', zero), stopReason: 'error' };
        return;
      default:
        break;
    }

    const input = this.inputTokens(req);
    if (step.kind === 'refusal') {
      const text = 'Simulated refusal.';
      yield { type: 'delta', segment: 0, origin: 'synthesis', text };
      const tokens = step.completeness === 'complete' ? { ...input, output: simulatedTokenCount(text) } : input;
      yield { type: 'final', usage: this.usage(req, startedAt, 'refused', 'refusal', step.completeness, 'none', tokens), stopReason: 'refusal', refusalCategory: step.category };
      return;
    }

    let segments: SimSegment[];
    let toolCalls: { name: string; bookId: string }[] = [];
    let explicitOutput: number | undefined;
    let reasoning: number | undefined;
    if (req.output.mode === 'structured') {
      const body = step.kind === 'malformed' ? '{"incomplete": ' : JSON.stringify(step.kind === 'success' ? step.structured ?? {} : {});
      segments = [{ origin: 'synthesis', text: body }];
    } else if (step.kind === 'success' && step.segments) {
      segments = step.segments;
    } else {
      segments = this.defaultSegments(req);
      if (step.kind === 'citation_error') segments[0] = { origin: 'library', text: 'Simulated misattribution.', cite: ['ref-outside-context'] };
    }
    if (step.kind === 'success') {
      toolCalls = step.toolCalls ?? [];
      explicitOutput = step.outputTokens;
      reasoning = step.reasoningTokens;
    }
    const limit = step.kind === 'partial_stream' ? step.deltas : Number.MAX_SAFE_INTEGER;

    let emitted = 0;
    let outputSoFar = 0;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      for (let at = 0; at < s.text.length; at += DELTA_CHARS) {
        if (signal.aborted || emitted >= limit) break;
        const text = s.text.slice(at, at + DELTA_CHARS);
        outputSoFar += simulatedTokenCount(text);
        emitted++;
        yield { type: 'delta', segment: i, origin: s.origin, text };
      }
      if (signal.aborted || emitted >= limit) break;
      for (const ref of s.cite ?? []) yield { type: 'citation', segment: i, ref };
    }
    if (step.kind === 'partial_stream' && !signal.aborted) {
      if (step.then === 'drop') return; // stream ends without a usage record
      await waitForAbort(signal);
    }
    if (signal.aborted) {
      yield { type: 'final', usage: this.usage(req, startedAt, 'aborted', 'client_abort', 'partial', 'none', { ...input, output: outputSoFar }), stopReason: 'error' };
      return;
    }
    for (const t of toolCalls) yield { type: 'tool_call', name: t.name, bookId: t.bookId };
    const output = explicitOutput ?? Math.min(outputSoFar, req.maxOutputTokens);
    const tokens: TokenCounts = { ...input, output };
    if (reasoning !== undefined && this.descriptor.reasoning.mode === 'separate_bound') tokens.reasoning = reasoning;
    const stopReason: StopReason = output >= req.maxOutputTokens ? 'max_tokens' : 'end_turn';
    yield { type: 'final', usage: this.usage(req, startedAt, 'completed', null, 'complete', 'none', tokens, toolCalls.length), stopReason };
  }
}
