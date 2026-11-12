import { IntelligenceDenied } from '../common/intelligence-denied.error';
import type { TurnCitation, TurnResult, TurnStage } from './turn.service';
import { TurnStatusDenied, TurnStatusDetail } from './turn-status.error';

/**
 * NEM-024 Checkpoint C — the SSE transport for `POST /knowledge/sessions/:id/turns/stream`.
 *
 * Event contract (in this order, each `event: <type>\ndata: <json>\n\n`):
 *   1. `stage` (0..n): `{ stage: 'checking' | 'searching' | 'composing' }`. Content-free, monotonic.
 *   2. for each answer segment i: `delta` `{ segment: i, text }`, then `segment` `{ segment: i, origin, bookId?, citations }`.
 *   3. `terminal` (exactly 1, always last): the outcome, with settlement and persistence information.
 *
 * Text release (no conflict with the Gateway or G5; see the Checkpoint C report §3): `delta`/`segment` are derived
 * from the `TurnResult`, which `TurnService` returns only AFTER (a) the Gateway validated and settled every attempt
 * (NEM-022 F-1/F-3) and (b) this request's own T1 commit was confirmed (G5), or in the D-8(a) `unrecorded` case. No
 * answer text or excerpt can therefore be written before validation, nor after the turn lost to a cancel or a fence.
 *
 * A transport close never cancels the turn (D-9 a): the turn promise is not linked to the connection; writes simply
 * stop. Only `POST …/turns/cancel` cancels.
 */
export type TurnStreamEvent =
  | { type: 'stage'; data: { stage: TurnStage } }
  | { type: 'delta'; data: { segment: number; text: string } }
  | { type: 'segment'; data: { segment: number; origin: string; bookId?: string; citations: TurnCitation[] } }
  | { type: 'terminal'; data: TurnTerminal };

export type TurnTerminalOutcome = 'completed' | 'failed' | 'cancelled' | 'interrupted' | 'pending' | 'unknown' | 'denied';

export interface TurnTerminal {
  outcome: TurnTerminalOutcome;
  /** HTTP-equivalent status of the outcome (200 when completed). */
  statusCode: number;
  turnId?: string;
  /** Completed only: `held` while any attempt awaits NEM-021 reconciliation (the ledger is the authority). */
  settlement?: 'settled' | 'held';
  /** True only when the turn is durably recorded (replayable). False for D-8(a) `unrecorded` and unrecorded failures. */
  persisted?: boolean;
  /** D-8(a) marker: delivered best effort, NOT saved to history; a same-key replay never reproduces it. */
  unrecorded?: true;
  replayed?: true;
  /** The full `TurnResult` v2 (completed only). */
  result?: TurnResult;
  /** Denials: the accepted reason code, safe message, and status payload (never question, answer, or excerpt text). */
  code?: string;
  message?: string;
  status?: TurnStatusDetail['status'];
  reservationRelease?: TurnStatusDetail['reservationRelease'];
  recorded?: boolean;
  exclusions?: TurnStatusDetail['exclusions'];
  retryAfterSeconds?: number;
  guard?: TurnStatusDetail['guard'];
}

/** One SSE frame. JSON never contains a raw newline, so a single `data:` line is always valid. */
export function formatSse(e: TurnStreamEvent): string {
  return `event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`;
}

/** The content events and terminal for a returned (validated, committed or D-8 unrecorded) result. */
export function resultEvents(result: TurnResult): TurnStreamEvent[] {
  const events: TurnStreamEvent[] = [];
  result.segments.forEach((seg, i) => {
    events.push({ type: 'delta', data: { segment: i, text: seg.text } });
    const bookId = (seg as { bookId?: string }).bookId;
    events.push({ type: 'segment', data: { segment: i, origin: seg.origin, ...(bookId ? { bookId } : {}), citations: result.citations?.[i] ?? [] } });
  });
  const persisted = !result.unrecorded;
  events.push({
    type: 'terminal',
    data: {
      outcome: 'completed', statusCode: 200, ...(result.turnId ? { turnId: result.turnId } : {}), settlement: result.settlement, persisted,
      ...(result.unrecorded ? { unrecorded: true as const } : {}), ...(result.replayed ? { replayed: true as const } : {}), result,
    },
  });
  return events;
}

const OUTCOME: Record<TurnStatusDetail['status'], TurnTerminalOutcome> = {
  failed: 'failed', cancelled: 'cancelled', interrupted: 'interrupted', accepted: 'pending', pending: 'pending', unknown: 'unknown',
};

/**
 * The terminal for a thrown error. Only `IntelligenceDenied` payloads (fixed codes and messages) are surfaced; any
 * other error becomes a generic `turn_failed` with nothing from the original error (no message, no stack).
 */
export function errorTerminal(e: unknown): TurnStreamEvent {
  const denial = e instanceof IntelligenceDenied ? e : new IntelligenceDenied('turn_failed');
  const body = denial.getResponse() as { code: string; message: string };
  const data: TurnTerminal = { outcome: 'denied', statusCode: denial.getStatus(), code: body.code, message: body.message };
  if (denial instanceof TurnStatusDenied) {
    const d = denial.detail;
    data.outcome = OUTCOME[d.status] ?? 'unknown';
    data.status = d.status;
    if (d.turnId) data.turnId = d.turnId;
    if (d.reservationRelease) data.reservationRelease = d.reservationRelease;
    if (d.recorded !== undefined) data.recorded = d.recorded;
    if (d.exclusions) data.exclusions = d.exclusions;
    if (d.retryAfterSeconds !== undefined) data.retryAfterSeconds = d.retryAfterSeconds;
    if (d.guard) data.guard = d.guard;
    if (d.recorded === false) data.persisted = false;
  }
  return { type: 'terminal', data };
}

/** The minimal response surface the transport needs (an Express/Node `ServerResponse` satisfies it). */
export interface SseResponse {
  status(code: number): unknown;
  setHeader(name: string, value: string): unknown;
  flushHeaders?(): void;
  write(chunk: string): boolean;
  end(): unknown;
  on(event: 'close' | 'error', listener: (...args: unknown[]) => void): unknown;
  readonly destroyed?: boolean;
  readonly writableEnded?: boolean;
}

export const SSE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // R-9: the dev nginx proxy may buffer; set by the response, no infrastructure change. Traefik streams.
  'X-Accel-Buffering': 'no',
};

/**
 * Runs one turn over SSE. `run` receives the stage callback and returns the turn's result (or throws a denial).
 * Resolves once the terminal has been written (or skipped because the client left). Never rejects. `delivered` means
 * only that the connection was still open when the terminal was written — never proof of receipt (D-8: best effort).
 */
export async function streamTurn(res: SseResponse, run: (onStage: (s: TurnStage) => void) => Promise<TurnResult>): Promise<{ delivered: boolean; outcome: TurnTerminalOutcome }> {
  let closed = false;
  res.on('close', () => { closed = true; });
  res.on('error', () => { closed = true; }); // a broken socket is a disconnect, never an unhandled error
  res.status(200);
  for (const [k, v] of Object.entries(SSE_HEADERS)) res.setHeader(k, v);
  res.flushHeaders?.();
  const send = (e: TurnStreamEvent): void => {
    if (closed || res.destroyed || res.writableEnded) { closed = true; return; }
    try {
      res.write(formatSse(e));
    } catch {
      closed = true;
    }
  };
  let lastStage = -1;
  const order: TurnStage[] = ['checking', 'searching', 'composing'];
  const onStage = (stage: TurnStage) => {
    const i = order.indexOf(stage);
    if (i <= lastStage) return; // monotonic, each stage at most once
    lastStage = i;
    send({ type: 'stage', data: { stage } });
  };
  let events: TurnStreamEvent[];
  try {
    events = resultEvents(await run(onStage));
  } catch (e) {
    events = [errorTerminal(e)];
  }
  for (const e of events) send(e);
  const delivered = !closed;
  if (!closed) {
    try {
      res.end();
    } catch {
      // already gone
    }
  }
  return { delivered, outcome: (events[events.length - 1].data as TurnTerminal).outcome };
}
