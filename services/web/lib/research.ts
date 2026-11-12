import { apiFetch, apiStream, currentAccountId, RESEARCH_RECOVERY_PREFIX } from './api';

/**
 * NEM-024 Checkpoint D — client logic for the minimal research Q&A screen (`/research/[sessionId]`).
 *
 * Contracts consumed (accepted Checkpoints A–C; unchanged here):
 * - `GET  /knowledge/sessions/capabilities` → CapabilityProbe (deny-first; 403 with a `code` when denied)
 * - `GET  /knowledge/sessions/:id` → SessionView
 * - `GET  /knowledge/sessions/:id/turns?limit=` → TurnView[] (newest first)
 * - `GET  /knowledge/sessions/:id/turns/:turnId` → TurnView
 * - `POST /knowledge/sessions/:id/turns/stream` (SSE: `stage`* → (`delta`, `segment`)* → one `terminal`)
 * - `POST /knowledge/sessions/:id/turns/cancel` { idempotencyKey } → { turnId?, status }
 *
 * Rules (doc 14 §3, §5; D-9 a; D-C1–D-C3): one idempotency key per question; recovery always reuses the SAME key
 * (no new reservation); a new key only on an explicit "Ask again"; a transport disconnect never calls cancel; the
 * server's English `message` is never displayed (the `code` is mapped to en/es copy); HTTP 200 on the stream does not
 * mean success: the `terminal` event decides (D-C3).
 */

export type Stage = 'checking' | 'searching' | 'composing';
export type SegmentOrigin = 'library' | 'synthesis' | 'broader' | 'user_content';
export type SourceState = 'available' | 'position_unavailable' | 'deferred' | 'revoked' | 'stale' | 'unavailable';

export interface CapabilityProbe {
  tier: string;
  capabilities: string[];
  features: { researchTurns: boolean; streaming: boolean; cancellation: boolean; history: boolean };
  limits: { maxBooks: number; questionMaxCodePoints: number; historyPageMax: number };
}

export interface SessionView {
  id: string;
  parentId: string | null;
  status: 'active' | 'read_only';
  locked: boolean;
  turnCount: number;
  books: { bookId: string | null; position: number; title: string; author: string }[];
  forkOffer: { maxBooks: number } | null;
}

export interface Citation {
  ref: string;
  kind: string;
  bookId: string | null;
  anchor: string | null;
  excerpt: string | null;
  sourceState: SourceState;
}

export interface Segment { origin: SegmentOrigin; text: string; bookId?: string }

export interface Exclusions { ineligible: string[]; unindexed: string[]; stale: string[]; unavailable: string[]; indexNotPermitted: string[] }

export type TurnStatus = 'accepted' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export interface TurnView {
  turnId: string;
  turnIndex: number | null;
  status: TurnStatus;
  question: string;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
  segments: Segment[] | null;
  citations: Citation[][] | null;
  exclusions: Exclusions | null;
  settlement: string | null;
}

export interface TurnResult {
  sessionId: string;
  turnId?: string;
  status?: 'completed';
  segments: Segment[];
  citations?: Citation[][];
  exclusions?: Exclusions;
  settlement: 'settled' | 'held';
  unrecorded?: true;
  replayed?: true;
}

export type TerminalOutcome = 'completed' | 'failed' | 'cancelled' | 'interrupted' | 'pending' | 'unknown' | 'denied';

export interface Terminal {
  outcome: TerminalOutcome;
  statusCode: number;
  turnId?: string;
  settlement?: 'settled' | 'held';
  persisted?: boolean;
  unrecorded?: true;
  replayed?: true;
  result?: TurnResult;
  code?: string;
  status?: string;
  reservationRelease?: 'released' | 'unconfirmed';
  recorded?: boolean;
  exclusions?: Partial<Exclusions>;
  retryAfterSeconds?: number;
  guard?: string;
}

export type StreamEvent =
  | { event: 'stage'; data: { stage: Stage } }
  | { event: 'delta'; data: { segment: number; text: string } }
  | { event: 'segment'; data: { segment: number; origin: SegmentOrigin; bookId?: string; citations: Citation[] } }
  | { event: 'terminal'; data: Terminal };

const EVENT_TYPES = new Set(['stage', 'delta', 'segment', 'terminal']);

/**
 * Incremental SSE parser. Feed it decoded text chunks in order; it returns the complete events seen so far and keeps
 * any partial frame for the next chunk. Unknown event types, comments, and malformed frames are ignored (fail closed:
 * nothing is rendered from them).
 */
export class SseParser {
  private buf = '';

  push(chunk: string): StreamEvent[] {
    this.buf += chunk.replace(/\r\n/g, '\n');
    const out: StreamEvent[] = [];
    let i: number;
    while ((i = this.buf.indexOf('\n\n')) >= 0) {
      const frame = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
      }
      if (!EVENT_TYPES.has(event) || data.length === 0) continue;
      try {
        out.push({ event, data: JSON.parse(data.join('\n')) } as StreamEvent);
      } catch {
        // malformed JSON: ignored
      }
    }
    return out;
  }
}

/** One idempotency key per question (`^[A-Za-z0-9_-]{8,64}$`). */
export function newIdempotencyKey(random: () => string = defaultRandom): string {
  const k = `q_${random().replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 64);
  return k.length >= 8 ? k : `${k}${'0'.repeat(8 - k.length)}`;
}
function defaultRandom(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export const codePointLength = (s: string): number => [...s].length;

// ── Recovery of an in-flight question across reloads (F-D1) ─────────────────────────────────────────────────────
//
// Lifecycle: the entry `{ key, question, owner, savedAt }` is written to **sessionStorage** (this tab only; gone when
// the tab closes) when a question is sent, and removed on any terminal outcome except `unknown`. It is discarded when:
// it is older than RECOVERY_TTL_MS; the signed-in account (`sub` of the access token) differs from `owner`; there is
// no signed-in account; or on logout (`clearToken` → `clearResearchRecovery`). Without a signed-in account nothing is
// written. It is a recovery aid for the same idempotency key, not conversation memory, and never sent anywhere except
// back to the same stream route by the same account.

export interface PendingQuestion { key: string; question: string }
interface StoredPending extends PendingQuestion { v: 1; owner: string; savedAt: number }
/** How long a pending question may be recovered after a reload; longer than any turn's server fence. */
export const RECOVERY_TTL_MS = 15 * 60 * 1000;
const pendingKey = (sessionId: string) => `${RESEARCH_RECOVERY_PREFIX}${sessionId}`;
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

function removeEverywhere(k: string): void {
  for (const getStore of [() => sessionStorage, () => localStorage]) {
    try {
      getStore().removeItem(k);
    } catch {
      // ignore
    }
  }
}

export function savePending(sessionId: string, p: PendingQuestion, now: number = Date.now()): void {
  const owner = currentAccountId();
  if (!owner) return; // no account → nothing persisted (fail closed)
  try {
    const entry: StoredPending = { v: 1, key: p.key, question: p.question, owner, savedAt: now };
    sessionStorage.setItem(pendingKey(sessionId), JSON.stringify(entry));
  } catch {
    // storage unavailable: recovery after reload is not possible, the turn itself is unaffected
  }
}

export function loadPending(sessionId: string, now: number = Date.now()): PendingQuestion | null {
  const k = pendingKey(sessionId);
  try {
    localStorage.removeItem(k); // legacy location (pre-F-D1 builds): never read, always purged
  } catch {
    // ignore
  }
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(k);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const e = JSON.parse(raw) as Partial<StoredPending>;
    const owner = currentAccountId();
    const valid = e.v === 1 && typeof e.key === 'string' && KEY_RE.test(e.key) && typeof e.question === 'string'
      && typeof e.owner === 'string' && owner !== null && e.owner === owner
      && typeof e.savedAt === 'number' && now - e.savedAt <= RECOVERY_TTL_MS && e.savedAt <= now + 60_000;
    if (valid) return { key: e.key as string, question: e.question as string };
  } catch {
    // malformed
  }
  removeEverywhere(k); // expired, foreign, or malformed: purge
  return null;
}

export function clearPending(sessionId: string): void {
  removeEverywhere(pendingKey(sessionId));
}

// ── Error mapping ───────────────────────────────────────────────────────────────────────────────────────────────

/** Every server denial code the screen can receive, mapped to an i18n key under `research.errors`. */
export const ERROR_CODES = [
  'turn_failed', 'scope_violation', 'budget_exhausted', 'budget_unavailable', 'unresolved_reservations', 'no_eligible_books',
  'set_changed', 'session_read_only', 'duplicate_turn', 'book_ineligible', 'not_found', 'invalid_request', 'feature_disabled',
  'no_entitlement', 'prerequisite_missing', 'policy_missing', 'capability_not_in_tier', 'limit_reached', 'session_locked', 'duplicate_book',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number] | 'generic';

export function errorCode(code: unknown): ErrorCode {
  return typeof code === 'string' && (ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : 'generic';
}

/** Codes for which the capability probe hides the screen (deny-first, neutral copy). */
export const ACCESS_DENIAL_CODES = new Set(['feature_disabled', 'no_entitlement', 'prerequisite_missing', 'policy_missing', 'capability_not_in_tier']);

// ── Display model ───────────────────────────────────────────────────────────────────────────────────────────────

export type DisplayStatus = 'completed' | 'unrecorded' | 'processing' | 'failed' | 'cancelled' | 'interrupted' | 'unknown' | 'busy';

export interface DisplayTurn {
  id: string;
  question: string;
  status: DisplayStatus;
  segments: Segment[];
  citations: Citation[][];
  exclusions: Exclusions | null;
  code: ErrorCode | null;
  /** Cancelled after the provider may have started, or release not confirmed: may count while it is confirmed. */
  mayCount: boolean;
  /** F-D2: for an `unknown` outcome, the SAME key + question that "Check again" replays (never a new key). */
  recovery?: PendingQuestion;
}

const EMPTY_EX: Exclusions = { ineligible: [], unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] };
const fullExclusions = (e?: Partial<Exclusions> | null): Exclusions | null => (e ? { ...EMPTY_EX, ...e } : null);

export function fromView(v: TurnView): DisplayTurn {
  const status: DisplayStatus = v.status === 'accepted' ? 'processing' : v.status;
  return {
    id: v.turnId, question: v.question, status,
    segments: v.status === 'completed' ? v.segments ?? [] : [], citations: v.status === 'completed' ? v.citations ?? [] : [],
    exclusions: fullExclusions(v.exclusions), code: v.status === 'failed' ? errorCode(v.failureReason ?? 'turn_failed') : null, mayCount: false,
  };
}

/** History is newest first; the conversation shows newest at the bottom. */
export const historyToTurns = (views: TurnView[]): DisplayTurn[] => [...views].reverse().map(fromView);

export type TerminalAction =
  | { kind: 'turn'; turn: DisplayTurn; clearPending: boolean }
  /** Same-key provisional turn: keep the key and poll this turn id. */
  | { kind: 'poll'; turnId: string | null }
  /** A denial not tied to a recorded turn (shown as a notice). */
  | { kind: 'notice'; code: ErrorCode; clearPending: boolean; readOnly?: boolean; budgetExhausted?: boolean; busy?: boolean };

/**
 * Maps the SSE `terminal` (or an equivalent JSON outcome) to what the screen does. `localId` names a turn that has no
 * server id (e.g. cancelled before reservation).
 */
export function terminalAction(t: Terminal, question: string, localId: string, key?: string): TerminalAction {
  const id = t.turnId ?? t.result?.turnId ?? localId;
  const code = errorCode(t.code);
  switch (t.outcome) {
    case 'completed': {
      const r = t.result;
      return {
        kind: 'turn', clearPending: true,
        turn: { id, question, status: t.unrecorded || r?.unrecorded || t.persisted === false ? 'unrecorded' : 'completed', segments: r?.segments ?? [], citations: r?.citations ?? [], exclusions: fullExclusions(r?.exclusions), code: null, mayCount: false },
      };
    }
    case 'cancelled':
      return {
        kind: 'turn', clearPending: true,
        turn: { id, question, status: 'cancelled', segments: [], citations: [], exclusions: null, code: null, mayCount: Boolean(t.turnId) && t.reservationRelease !== 'released' },
      };
    case 'interrupted':
      return { kind: 'turn', clearPending: true, turn: { id, question, status: 'interrupted', segments: [], citations: [], exclusions: null, code: null, mayCount: false } };
    case 'failed':
      if (code === 'duplicate_turn') return { kind: 'notice', code, clearPending: true, busy: true }; // another question in progress
      return {
        kind: 'turn', clearPending: true,
        turn: { id, question, status: 'failed', segments: [], citations: [], exclusions: fullExclusions(t.exclusions), code, mayCount: t.reservationRelease === 'unconfirmed' },
      };
    case 'pending':
      if (t.guard) return { kind: 'notice', code: 'budget_unavailable', clearPending: true };
      return { kind: 'poll', turnId: t.turnId ?? null };
    case 'unknown':
      // Nothing confirmed: keep the key so "Check again" replays it (same key, no new charge).
      return {
        kind: 'turn', clearPending: false,
        turn: { id, question, status: 'unknown', segments: [], citations: [], exclusions: null, code: null, mayCount: false, ...(key ? { recovery: { key, question } } : {}) },
      };
    case 'denied':
    default:
      return { kind: 'notice', code, clearPending: true, readOnly: code === 'session_read_only', budgetExhausted: code === 'budget_exhausted' };
  }
}

// ── API calls (all through apiFetch / apiStream) ────────────────────────────────────────────────────────────────

const base = '/knowledge/sessions';
export const getCapabilities = (): Promise<CapabilityProbe> => apiFetch(`${base}/capabilities`);
export const getSession = (id: string): Promise<SessionView> => apiFetch(`${base}/${encodeURIComponent(id)}`);
export const getHistory = (id: string, limit: number): Promise<TurnView[]> => apiFetch(`${base}/${encodeURIComponent(id)}/turns?limit=${limit}`);
export const getTurn = (id: string, turnId: string): Promise<TurnView> => apiFetch(`${base}/${encodeURIComponent(id)}/turns/${encodeURIComponent(turnId)}`);
export const cancelTurn = (id: string, key: string): Promise<{ turnId?: string; status: string }> =>
  apiFetch(`${base}/${encodeURIComponent(id)}/turns/cancel`, { method: 'POST', body: JSON.stringify({ idempotencyKey: key }) });

/** The `code` of a thrown apiFetch error (never its English message). */
export function apiErrorCode(e: unknown): { status: number | null; code: ErrorCode } {
  const err = e as { status?: number; data?: { code?: unknown } } | null;
  return { status: typeof err?.status === 'number' ? err.status : null, code: errorCode(err?.data?.code) };
}

export interface StreamHandlers {
  onStage(stage: Stage): void;
  onTerminal(t: Terminal): void;
}

/**
 * Runs one question over SSE. Resolves `'terminal'` when a terminal event arrived, or `'lost'` when the connection
 * ended without one (network failure, server restart, `signal` aborted by navigation). `'lost'` is never treated as
 * a cancellation; the caller recovers with the same key. Content arrives only inside the terminal's `result`
 * (D-C1: the per-segment frames carry the same validated text; the terminal is authoritative).
 */
export async function runQuestionStream(
  sessionId: string, key: string, question: string, h: StreamHandlers, signal?: AbortSignal,
): Promise<'terminal' | 'lost'> {
  let res: Response;
  try {
    res = await apiStream(`${base}/${encodeURIComponent(sessionId)}/turns/stream`, {
      method: 'POST', body: JSON.stringify({ idempotencyKey: key, question }), headers: { Accept: 'text/event-stream' }, signal,
    });
  } catch (e) {
    if ((e as { status?: number })?.status === 401) throw e;
    return 'lost';
  }
  // Before the stream opens, errors are ordinary HTTP JSON (D-C3).
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.startsWith('text/event-stream') || !res.body) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.code) {
      h.onTerminal({ outcome: 'denied', statusCode: res.status, code: typeof data?.code === 'string' ? data.code : undefined });
      return 'terminal';
    }
    return 'lost';
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      const events = done ? parser.push(decoder.decode()) : parser.push(decoder.decode(value, { stream: true }));
      for (const e of events) {
        if (e.event === 'stage') h.onStage(e.data.stage);
        else if (e.event === 'terminal') {
          h.onTerminal(e.data);
          return 'terminal';
        }
      }
      if (done) return 'lost';
    }
  } catch {
    return 'lost';
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

/** The reader link for a book ("Open book": link only, the reader is untouched; no exact position). */
export const readerHref = (bookId: string): string => `/reader/${encodeURIComponent(bookId)}`;
