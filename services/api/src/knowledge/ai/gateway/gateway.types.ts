import type {
  AttemptOutcome, CacheIntent, ErrorCategory, NormalizedUsage, UsageCompleteness, ValidatedCapabilityDescriptor,
} from '../contract';
import type { Capability, IntelligenceTier, SegmentOrigin } from '../../knowledge.types';
import type { ModelPathId } from '../model-paths';
import type { ContextItemKind, VerifiedContext } from '../verified-context';

/**
 * NEM-022 Gateway v2 types. Every usage, outcome, and error type comes from frozen contract v1 (§9);
 * nothing here redefines them. Re-exported so callers outside `ai/` never import the contract directly.
 */
export type { AttemptOutcome, CacheIntent, ErrorCategory, NormalizedUsage, UsageCompleteness };

/** The JSON-Schema subset accepted for structured output (validated by `structured-output.ts`). */
export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: readonly (string | number | boolean | null)[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}

export type OutputMode = { mode: 'text' } | { mode: 'structured'; schema: JsonSchema };

/** Whose budget an attempt draws on (per-user units, global micro-USD). */
export interface BudgetIdentity {
  userId: string;
  tier: IntelligenceTier;
  capability: Capability;
  sessionId: string | null;
}

/** A Gateway request (§5.1). There is no free-form prompt: only a template bound to the model path. */
export interface GatewayRequest {
  pathId: ModelPathId;
  context: VerifiedContext;
  templateId: string;
  /** Capability keys the serving model must declare (e.g. `research_session`). */
  requiredCapabilities: string[];
  /** Features the caller depends on (structured output is implied by `output`). */
  requiredFeatures?: { streaming?: boolean; citations?: boolean };
  output: OutputMode;
  maxOutputTokens: number;
  cacheIntent: CacheIntent;
  /** Server-side turn key; each attempt's idempotency key is derived from it and the attempt number. */
  turnKey: string;
  budget: BudgetIdentity;
  /** Upper bound per billable non-token unit; undeclared keys are ignored, declared but missing ones are 0. */
  nonTokenUnitBounds?: Record<string, number>;
}

/** Template-delimited prompt: instructions and context data travel in separate channels (§11 injection rule). */
export interface ContextBlock {
  ref: string;
  kind: ContextItemKind;
  bookId: string | null;
  /** Context data, neutralized so it cannot close its own block. Never part of `instructions`. */
  text: string;
}

export interface PromptEnvelope {
  templateId: string;
  instructions: string;
  contextBlocks: readonly ContextBlock[];
}

/** What a provider adapter receives for one attempt. */
export interface AdapterRequest {
  attemptKey: string;
  envelope: PromptEnvelope;
  maxOutputTokens: number;
  cacheIntent: CacheIntent;
  output: OutputMode;
  /** The non-token unit bounds reserved for this attempt (the adapter must not exceed them). */
  nonTokenUnitBounds: Readonly<Record<string, number>>;
}

export type StopReason = 'end_turn' | 'max_tokens' | 'refusal' | 'error';

/** Provider-level stream events (adapter → Gateway). */
export type AdapterEvent =
  | { type: 'delta'; segment: number; origin: SegmentOrigin; text: string }
  | { type: 'citation'; segment: number; ref: string; anchor?: string }
  | { type: 'tool_call'; name: string; bookId: string }
  | {
      type: 'final';
      /** The adapter's contract-v1 usage record for this attempt. */
      usage: NormalizedUsage;
      stopReason?: StopReason;
      refusalCategory?: string;
      /** Provider-advised wait before retrying (rate limits). */
      retryAfterMs?: number;
    };

/**
 * A provider adapter. Only simulated adapters may be registered until the launch-readiness gate.
 * `invoke` must honour `signal`: on abort it yields at most one `final` event and returns.
 */
export interface ProviderAdapter {
  readonly simulated: boolean;
  readonly descriptor: ValidatedCapabilityDescriptor;
  /** Input tokens for the envelope, by the descriptor's counting method (exact or a documented estimate). */
  countTokens(envelope: PromptEnvelope, output: OutputMode): number;
  invoke(request: AdapterRequest, signal: AbortSignal): AsyncIterable<AdapterEvent>;
}

export const PROVIDER_ADAPTERS = Symbol('PROVIDER_ADAPTERS');

export interface GatewayCitation {
  ref: string;
  anchor?: string;
  kind: ContextItemKind;
  bookId: string | null;
}

/** A validated answer segment: origin and citations are checked against the sealed context. */
export interface GatewaySegment {
  origin: SegmentOrigin;
  text: string;
  citations: GatewayCitation[];
}

/** Settlement status reported by the ledger for one attempt, or `ledger_error` (the attempt stays held). */
export type AttemptSettlement = 'settled' | 'partially_settled' | 'released' | 'held' | 'already_resolved' | 'no_reservation' | 'ledger_error';

export interface AttemptRecord {
  attemptNumber: number;
  attemptKey: string;
  outcome: AttemptOutcome;
  error: ErrorCategory | null;
  usageCompleteness: UsageCompleteness;
  settlement: AttemptSettlement;
}

/** Counts a caller needs for reconstruction safeguards (E6) — no content. */
export interface ResponseCounts {
  segments: number;
  librarySegments: number;
  citedItems: number;
  outputTokens: number;
}

export interface GatewayResponse {
  outcome: AttemptOutcome;
  error: ErrorCategory | null;
  stopReason: StopReason | null;
  refusalCategory: string | null;
  /** Validated segments; empty when a scope violation occurred. */
  segments: GatewaySegment[];
  scopeViolation: boolean;
  /** Present only for structured output that passed validation. */
  structured?: unknown;
  /** The final attempt's normalized usage. */
  usage: NormalizedUsage;
  attempts: AttemptRecord[];
  /** `settled` when every attempt resolved (settled or released); otherwise something is still held. */
  settlement: 'settled' | 'held';
  counts: ResponseCounts;
}

/** Consumer-facing stream events (Gateway → caller). Origins are only asserted once validated. */
export type GatewayEvent =
  | { type: 'delta'; segment: number; text: string }
  | { type: 'segment'; segment: number; origin: SegmentOrigin; citations: GatewayCitation[] }
  | { type: 'retry'; attemptNumber: number; afterMs: number }
  | { type: 'usage'; attempt: AttemptRecord; usage: NormalizedUsage }
  | { type: 'terminal'; response: GatewayResponse };
