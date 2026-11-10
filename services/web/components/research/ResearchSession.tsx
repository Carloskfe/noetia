'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import CitationDialog from './CitationDialog';
import {
  ACCESS_DENIAL_CODES, apiErrorCode, CapabilityProbe, cancelTurn, Citation, clearPending, codePointLength, DisplayTurn, ErrorCode, Exclusions,
  getCapabilities, getHistory, getSession, getTurn, historyToTurns, fromView, loadPending, newIdempotencyKey, runQuestionStream, savePending,
  SessionView, Stage, terminalAction, Terminal,
} from '@/lib/research';

/**
 * NEM-024 Checkpoint D — the minimal research Q&A screen for ONE existing session (mission §5 item 13, §5.1; doc 14).
 * Out of scope here: session creation, book selection, session management, navigation entries, user knowledge.
 */

type Load =
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | { kind: 'ready'; caps: CapabilityProbe; session: SessionView };

type Phase =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'stage'; stage: Stage }
  | { kind: 'recovering' }
  | { kind: 'processing' }
  | { kind: 'cancelling' };

interface InFlight { key: string; question: string }

const POLL_MS = 3000;
const MAX_AUTO_RECOVERY = 1;
/** F-D3: an open stream that has not delivered its terminal this long after a cancel is dropped (delivery only, never a
 * cancel) and the SAME key is replayed, so the screen can never stay in "Cancelling…". */
const CANCEL_WATCHDOG_MS = 15_000;

export default function ResearchSession({ sessionId, pollMs = POLL_MS, recoveryDelayMs = 2000, cancelWatchdogMs = CANCEL_WATCHDOG_MS }: {
  sessionId: string; pollMs?: number; recoveryDelayMs?: number; cancelWatchdogMs?: number;
}) {
  const { t } = useTranslation();
  const r = t.research;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState<ErrorCode | null>(null);
  const [lost, setLost] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [budgetExhausted, setBudgetExhausted] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [dialog, setDialog] = useState<{ n: number; citation: Citation; title: string; trigger: HTMLElement | null } | null>(null);
  const inFlight = useRef<InFlight | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** F-D3: the provisional turn currently being polled (null when not polling). */
  const pollingTurnId = useRef<string | null>(null);
  const cancelWatch = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>({ kind: 'idle' });
  const mounted = useRef(true);
  const autoRecoveries = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  phaseRef.current = phase;
  const announce = useCallback((msg: string) => setAnnouncement(msg), []);

  const upsert = useCallback((turn: DisplayTurn) => {
    setTurns((prev) => {
      const i = prev.findIndex((x) => x.id === turn.id);
      if (i < 0) return [...prev, turn];
      const next = prev.slice();
      next[i] = turn;
      return next;
    });
  }, []);

  /** Lock and read-only state come from the server after every outcome (never inferred). */
  const refreshSession = useCallback(() => {
    getSession(sessionId).then((session) => {
      if (!mounted.current) return;
      setLoad((l) => (l.kind === 'ready' ? { ...l, session } : l));
      if (session.status === 'read_only') setReadOnly(true);
    }).catch(() => undefined);
  }, [sessionId]);

  const clearCancelWatch = () => {
    if (cancelWatch.current) clearTimeout(cancelWatch.current);
    cancelWatch.current = null;
  };

  const finish = useCallback(() => {
    inFlight.current = null;
    controller.current = null;
    pollingTurnId.current = null;
    clearCancelWatch();
    setPhase({ kind: 'idle' });
  }, []);

  // ── Terminal handling ─────────────────────────────────────────────────────────────────────────────────────────
  const statusText = useCallback((turn: DisplayTurn): string => {
    switch (turn.status) {
      case 'completed': return r.status.answerReady;
      case 'unrecorded': return `${r.status.answerReady}. ${r.status.unrecorded}`;
      case 'cancelled': return r.status.cancelled;
      case 'interrupted': return r.status.interrupted;
      case 'failed': return turn.code ? r.errors[turn.code] : r.status.failed;
      case 'unknown': return r.status.unknown;
      default: return r.status.processing;
    }
  }, [r]);

  const pollTurn = useCallback((turnId: string | null, q: InFlight) => {
    pollingTurnId.current = turnId;
    clearCancelWatch();
    setPhase({ kind: 'processing' });
    announce(r.stage.processing);
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(async function tick() {
      if (!mounted.current) return;
      try {
        if (turnId) {
          const v = await getTurn(sessionId, turnId);
          if (v.status !== 'accepted') {
            const turn = fromView(v);
            upsert(turn);
            announce(statusText(turn));
            clearPending(sessionId);
            finish();
            refreshSession();
            return;
          }
        } else {
          // No turn id yet: replay with the SAME key (never a new key, never a new charge).
          void ask(q, true);
          return;
        }
      } catch {
        // transient: keep polling
      }
      pollTimer.current = setTimeout(tick, pollMs);
    }, pollMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, pollMs, upsert, finish, refreshSession, announce, statusText, r]);

  const onTerminal = useCallback((term: Terminal, q: InFlight) => {
    const a = terminalAction(term, q.question, `local-${q.key}`, q.key);
    if (a.kind === 'poll') {
      upsert({ id: a.turnId ?? `local-${q.key}`, question: q.question, status: 'processing', segments: [], citations: [], exclusions: null, code: null, mayCount: false });
      pollTurn(a.turnId, q);
      return;
    }
    if (a.clearPending) clearPending(sessionId);
    if (a.kind === 'turn') {
      const turn = a.turn;
      setTurns((prev) => {
        const rest = prev.filter((x) => x.id !== `local-${q.key}` || turn.id === x.id);
        const existing = rest.find((x) => x.id === turn.id);
        // A replay carries deferred citations; never downgrade a history entry that already has re-validated excerpts.
        if (term.replayed && existing?.status === 'completed') return rest;
        const i = rest.findIndex((x) => x.id === turn.id);
        if (i < 0) return [...rest, turn];
        const next = rest.slice();
        next[i] = turn;
        return next;
      });
      announce(statusText(turn));
      if (turn.status === 'completed' || turn.status === 'unrecorded') setQuestion('');
    } else {
      setNotice(a.code);
      if (a.readOnly) setReadOnly(true);
      if (a.budgetExhausted) setBudgetExhausted(true);
      announce(r.errors[a.code]);
    }
    finish();
    refreshSession();
  }, [sessionId, upsert, pollTurn, finish, refreshSession, announce, statusText, r]);

  // ── Asking (new question or same-key recovery) ──────────────────────────────────────────────────────────────
  const ask = useCallback(async (q: InFlight, recovering: boolean) => {
    inFlight.current = q;
    pollingTurnId.current = null;
    clearCancelWatch();
    savePending(sessionId, q);
    setNotice(null);
    setLost(false);
    setPhase(recovering ? { kind: 'recovering' } : { kind: 'submitting' });
    announce(recovering ? r.stage.recovering : r.stage.submitting);
    const ac = new AbortController();
    controller.current = ac;
    let outcome: 'terminal' | 'lost';
    try {
      outcome = await runQuestionStream(sessionId, q.key, q.question, {
        onStage: (stage) => {
          if (!mounted.current || inFlight.current?.key !== q.key) return;
          setPhase((p) => (p.kind === 'cancelling' ? p : { kind: 'stage', stage }));
          announce(r.stage[stage]);
        },
        onTerminal: (term) => {
          if (!mounted.current) return;
          onTerminal(term, q);
        },
      }, ac.signal);
    } catch {
      return; // 401: apiFetch/apiStream already redirected to login
    }
    if (outcome === 'lost' && mounted.current) {
      // A lost connection is NEVER a cancellation (D-9 a): recover with the same key.
      setLost(true);
      announce(r.status.connectionLost);
      if (autoRecoveries.current < MAX_AUTO_RECOVERY) {
        autoRecoveries.current++;
        pollTimer.current = setTimeout(() => { if (mounted.current && inFlight.current?.key === q.key) void ask(q, true); }, recoveryDelayMs);
      } else {
        setPhase({ kind: 'idle' }); // the "Check again" button replays the same key
      }
    }
  }, [sessionId, onTerminal, announce, recoveryDelayMs, r]);

  // ── Initial load: probe first (deny-first), then session, history, and any pending question ─────────────────
  useEffect(() => {
    mounted.current = true;
    (async () => {
      let caps: CapabilityProbe;
      try {
        caps = await getCapabilities();
      } catch (e) {
        const { status, code } = apiErrorCode(e);
        if (!mounted.current) return;
        setLoad(status === 403 || ACCESS_DENIAL_CODES.has(code) ? { kind: 'denied' } : { kind: 'error' });
        return;
      }
      if (!caps.features?.researchTurns || !caps.capabilities?.includes('research_session')) {
        if (mounted.current) setLoad({ kind: 'denied' });
        return;
      }
      try {
        const [session, history] = await Promise.all([getSession(sessionId), getHistory(sessionId, caps.limits.historyPageMax)]);
        if (!mounted.current) return;
        setTurns(historyToTurns(history));
        setReadOnly(session.status === 'read_only');
        setLoad({ kind: 'ready', caps, session });
        const pending = loadPending(sessionId);
        if (pending) void ask(pending, true); // same-key recovery after a reload or disconnect
      } catch (e) {
        if (!mounted.current) return;
        const { status, code } = apiErrorCode(e);
        setLoad(status === 404 || code === 'not_found' ? { kind: 'not_found' } : ACCESS_DENIAL_CODES.has(code) ? { kind: 'denied' } : { kind: 'error' });
      }
    })();
    return () => {
      // Leaving the page drops delivery only; the turn continues on the server and is recovered by key (D-9 a).
      mounted.current = false;
      controller.current?.abort();
      if (pollTimer.current) clearTimeout(pollTimer.current);
      if (cancelWatch.current) clearTimeout(cancelWatch.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Explicit cancellation (the only path that cancels) ──────────────────────────────────────────────────────
  const busy = phase.kind !== 'idle';
  /** F-D3: back to a recoverable state for the SAME key: poll the known provisional turn, or replay the key. */
  const resume = useCallback((q: InFlight, turnId: string | null) => {
    if (!mounted.current) return;
    if (turnId) pollTurn(turnId, q);
    else void ask(q, true);
  }, [pollTurn, ask]);

  const cancel = useCallback(async () => {
    const q = inFlight.current;
    if (!q || phase.kind === 'cancelling') return;
    const before = phase;
    const pollingId = pollingTurnId.current;
    const streaming = phase.kind !== 'processing' && controller.current !== null;
    setPhase({ kind: 'cancelling' });
    announce(r.stage.cancelling);
    if (streaming) {
      // The open stream's terminal decides; if it never arrives, drop delivery (not a cancel) and replay the same key.
      clearCancelWatch();
      cancelWatch.current = setTimeout(() => {
        if (mounted.current && inFlight.current?.key === q.key && phaseRef.current.kind === 'cancelling') controller.current?.abort();
      }, cancelWatchdogMs);
    }
    try {
      const res = await cancelTurn(sessionId, q.key);
      if (!mounted.current || inFlight.current?.key !== q.key) return;
      if (streaming) return;
      if (pollTimer.current) clearTimeout(pollTimer.current);
      const id = res.status !== 'cancel_requested' && res.turnId ? res.turnId : null;
      // cancel_requested or no turn id while polling: never stay in "Cancelling…" — resume polling or replay the key.
      if (!id) { resume(q, pollingId); return; }
      const v = await getTurn(sessionId, id);
      if (!mounted.current) return;
      if (v.status === 'accepted') { pollTurn(id, q); return; }
      const turn = fromView(v);
      upsert(turn);
      announce(statusText(turn));
      clearPending(sessionId);
      finish();
      refreshSession();
    } catch (e) {
      if (!mounted.current || inFlight.current?.key !== q.key) return;
      setNotice(apiErrorCode(e).code);
      if (streaming) {
        clearCancelWatch();
        setPhase((p) => (p.kind === 'cancelling' ? before : p)); // the stream continues; its terminal decides
      } else {
        if (pollTimer.current) clearTimeout(pollTimer.current);
        resume(q, pollingId);
      }
    }
  }, [phase, sessionId, pollTurn, resume, upsert, statusText, finish, refreshSession, announce, cancelWatchdogMs, r]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && busy && !dialog) void cancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, cancel, dialog]);

  // ── Rendering ───────────────────────────────────────────────────────────────────────────────────────────────
  if (load.kind === 'loading') return <main className="mx-auto max-w-3xl p-4"><p role="status">{r.loading}</p></main>;
  if (load.kind === 'denied') {
    return (
      <main className="mx-auto max-w-3xl p-4 space-y-3">
        <h1 className="text-xl font-semibold">{r.unavailable.title}</h1>
        <p>{r.unavailable.body}</p>
        <Link href="/library" className="underline">{r.unavailable.back}</Link>
      </main>
    );
  }
  if (load.kind === 'not_found' || load.kind === 'error') {
    return (
      <main className="mx-auto max-w-3xl p-4 space-y-3">
        <p role="alert">{load.kind === 'not_found' ? r.notFound : r.loadError}</p>
        <Link href="/library" className="underline">{r.backToLibrary}</Link>
      </main>
    );
  }

  const { caps, session } = load;
  const max = caps.limits.questionMaxCodePoints;
  const qLen = codePointLength(question.normalize('NFC').trim());
  const tooLong = qLen > max;
  const lastEx = [...turns].reverse().find((x) => x.exclusions)?.exclusions ?? null;
  const excludedIds = new Set(lastEx ? Object.values(lastEx).flat() : []);
  const titleOf = (bookId: string | null) => session.books.find((b) => b.bookId === bookId)?.title ?? r.citation.unknownBook;
  const blocked = readOnly || budgetExhausted || notice === 'duplicate_turn';
  const canAsk = !busy && !blocked && qLen >= 1 && !tooLong;

  const submit = () => {
    if (!canAsk) return;
    autoRecoveries.current = 0;
    void ask({ key: newIdempotencyKey(), question: question.normalize('NFC').trim() }, false);
  };
  const askAgain = (q: string) => {
    if (busy || blocked) return;
    autoRecoveries.current = 0;
    void ask({ key: newIdempotencyKey(), question: q }, false); // explicit action only: a new key is a new question
  };
  /** Replays the SAME key: the unknown turn's own key (F-D2), else the in-flight or stored pending question. */
  const checkAgain = (turn?: DisplayTurn) => {
    const p = turn?.recovery ?? inFlight.current ?? loadPending(sessionId);
    if (p && !busy) { autoRecoveries.current = 0; void ask(p, true); }
  };
  const stageText = phase.kind === 'stage' ? r.stage[phase.stage] : phase.kind === 'idle' ? '' : r.stage[phase.kind];

  let citationNo = 0;
  return (
    <main className="mx-auto max-w-3xl p-4 space-y-4 text-gray-900 dark:text-gray-100">
      <header className="flex items-center justify-between gap-2">
        <Link href="/library" className="text-sm underline">{r.backToLibrary}</Link>
        <h1 className="text-lg font-semibold">{r.title}</h1>
        <span aria-hidden="true" />
      </header>

      <section aria-labelledby="research-books">
        <h2 id="research-books" className="text-sm font-medium">{r.books.label}</h2>
        {session.books.length === 0 ? <p className="text-sm">{r.books.none}</p> : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {session.books.map((b) => {
              const excluded = b.bookId ? excludedIds.has(b.bookId) : true;
              return (
                <li key={`${b.position}`} className={`rounded-full border px-3 py-1 text-sm ${excluded ? 'border-dashed text-gray-500 dark:text-gray-400' : 'border-gray-400'}`}>
                  <span>{b.title}</span>
                  {excluded ? <span className="ml-1">· {r.books.excluded}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-1 text-xs" data-testid="lock-state">{session.locked ? r.books.locked : r.books.unlocked}</p>
      </section>

      {readOnly ? (
        <div role="note" className="rounded border border-amber-500 p-3 text-sm">
          <p>{r.readOnly}</p>
          {session.forkOffer ? <p className="mt-1 text-xs">{r.forkNotice(session.forkOffer.maxBooks)}</p> : null}
        </div>
      ) : null}

      <section aria-label={r.conversation.label} className="space-y-4">
        {turns.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-300">{r.conversation.empty}</p> : null}
        {turns.map((turn) => (
          <article key={turn.id} className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3" data-status={turn.status}>
            <p className="text-sm"><span className="font-semibold">{r.conversation.you}: </span>{turn.question}</p>
            {turn.segments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{r.conversation.noetia}:</p>
                {turn.segments.map((seg, i) => (seg.origin === 'broader' ? null : (
                  <div key={i} className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 text-sm">
                    <span className="mr-2 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs font-medium">{r.origin[seg.origin]}</span>
                    <span className="whitespace-pre-wrap">{seg.text}</span>
                    {(turn.citations[i] ?? []).map((c) => {
                      citationNo++;
                      const n = citationNo;
                      const title = titleOf(c.bookId);
                      return (
                        <button
                          key={`${c.ref}-${n}`}
                          type="button"
                          aria-label={r.citation.button(n, title)}
                          aria-haspopup="dialog"
                          onClick={(e) => setDialog({ n, citation: c, title, trigger: e.currentTarget })}
                          className="ml-1 rounded border px-1 text-xs underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          [{n}]
                        </button>
                      );
                    })}
                  </div>
                )))}
              </div>
            ) : null}
            {turn.exclusions ? <Disclosures ex={turn.exclusions} /> : null}
            <TurnStatusLine turn={turn} onAskAgain={() => askAgain(turn.question)} onCheckAgain={() => checkAgain(turn)} disabled={busy || blocked} />
          </article>
        ))}
      </section>

      {/* Screen-reader progress: stage texts and outcomes only, never answer text (doc 14 §6). */}
      <div role="log" aria-live="polite" aria-label={r.progressLabel} className="sr-only" data-testid="live-log">{announcement}</div>

      {busy ? (
        <div className="flex items-center justify-between rounded border border-gray-300 dark:border-gray-600 p-3" data-testid="progress">
          <p className="text-sm motion-safe:animate-pulse">{stageText}</p>
          {phase.kind !== 'cancelling' ? (
            <button type="button" onClick={() => void cancel()} className="rounded border px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" aria-describedby="cancel-hint">
              {r.cancel}
            </button>
          ) : null}
          <span id="cancel-hint" className="sr-only">{r.cancelHint}</span>
        </div>
      ) : null}
      {lost && !busy ? (
        <div role="alert" className="rounded border p-3 text-sm">
          <p>{r.status.connectionLost}</p>
          <button type="button" onClick={() => checkAgain()} className="mt-2 underline">{r.status.checkAgain}</button>
        </div>
      ) : null}
      {notice ? <p role="alert" className="text-sm text-red-700 dark:text-red-400" data-testid="notice">{r.errors[notice]}</p> : null}

      {!readOnly ? (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-2">
          <label htmlFor="research-question" className="block text-sm font-medium">{r.ask.label}</label>
          <textarea
            id="research-question"
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
            placeholder={r.ask.placeholder}
            aria-describedby="research-hint research-counter"
            aria-invalid={tooLong}
            disabled={busy || blocked}
            rows={3}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
          />
          <div className="flex items-center justify-between gap-2 text-xs">
            <span id="research-hint">{r.ask.hint}</span>
            <span id="research-counter" className={tooLong ? 'text-red-700 dark:text-red-400' : ''}>{tooLong ? r.ask.tooLong(max) : r.ask.counter(qLen, max)}</span>
          </div>
          <button type="submit" disabled={!canAsk} className="rounded bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm text-white dark:text-gray-900 disabled:opacity-50">
            {r.ask.submit}
          </button>
        </form>
      ) : null}

      {dialog ? (
        <CitationDialog
          n={dialog.n}
          citation={dialog.citation}
          bookTitle={dialog.title}
          onClose={() => { const tr = dialog.trigger; setDialog(null); tr?.focus(); }}
        />
      ) : null}
    </main>
  );
}

function Disclosures({ ex }: { ex: Exclusions }) {
  const { t } = useTranslation();
  const e = t.research.exclusions;
  const items = (Object.keys(e) as (keyof Exclusions)[]).filter((k) => ex[k]?.length > 0).map((k) => e[k](ex[k].length));
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300" data-testid="disclosures">
      {items.map((s) => <li key={s}>ⓘ {s}</li>)}
    </ul>
  );
}

function TurnStatusLine({ turn, onAskAgain, onCheckAgain, disabled }: { turn: DisplayTurn; onAskAgain: () => void; onCheckAgain: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  const s = t.research.status;
  const again = (
    <button type="button" onClick={onAskAgain} disabled={disabled} className="ml-2 underline disabled:opacity-50" aria-describedby={`again-${turn.id}`}>
      {s.askAgain}<span id={`again-${turn.id}`} className="sr-only"> — {s.askAgainHint}</span>
    </button>
  );
  switch (turn.status) {
    case 'completed': return null;
    case 'unrecorded': return <p className="text-xs" data-testid="turn-status">{s.unrecorded}</p>;
    case 'processing': return <p className="text-xs" data-testid="turn-status">{s.processing}</p>;
    case 'cancelled': return <p className="text-xs" data-testid="turn-status">{s.cancelled}{turn.mayCount ? ` ${s.mayCount}` : ''}{again}</p>;
    case 'interrupted': return <p className="text-xs" data-testid="turn-status">{s.interrupted}{again}</p>;
    case 'failed': return <p className="text-xs" data-testid="turn-status">{turn.code ? t.research.errors[turn.code] : s.failed}{turn.mayCount ? ` ${s.mayCount}` : ''}{again}</p>;
    case 'unknown': return <p className="text-xs" data-testid="turn-status">{s.unknown}<button type="button" onClick={onCheckAgain} disabled={disabled} className="ml-2 underline">{s.checkAgain}</button></p>;
    default: return null;
  }
}
