import { SEGMENT_ORIGINS, SegmentOrigin } from '../../knowledge.types';
import { ContextItem, VerifiedContext } from '../verified-context';
import { GatewayCitation, GatewaySegment } from './gateway.types';

/**
 * Citation and origin enforcement (NEM-022 §5.6; ADR-003 origins; ADR-006 trust boundary).
 *
 * Scope violations (the whole answer is dropped, metric, existing rules):
 * - a citation to a ref that is not in the sealed context, or to an item whose book is outside the allowed set;
 * - a tool/planner argument naming a book outside the allowed set;
 * - an origin label outside the four origins.
 *
 * Origin rules (relabelled, never dropped):
 * - `library` (book text) needs at least one citation, and every citation must be a book `chunk`.
 *   A library passage citing a user highlight or note would attribute user content to a book.
 * - `user_content` may cite only the user's own highlights and notes, never book chunks.
 * - `broader` is model knowledge only and carries no citations.
 * Any segment failing its rule is relabelled `synthesis`.
 */
export interface RawSegment {
  origin: string;
  text: string;
  citations: { ref: string; anchor?: string }[];
}

export interface CitationOutcome {
  segments: GatewaySegment[];
  scopeViolation: boolean;
  relabelled: number;
}

export function citationFor(context: VerifiedContext, ref: string, anchor?: string): GatewayCitation | null {
  const item: ContextItem | undefined = context.items.find((i) => i.ref === ref);
  if (!item || !item.bookId || !context.allowedBookIds.includes(item.bookId)) return null;
  return anchor === undefined ? { ref, kind: item.kind, bookId: item.bookId } : { ref, anchor, kind: item.kind, bookId: item.bookId };
}

export function originAfterRules(origin: SegmentOrigin, citations: GatewayCitation[]): SegmentOrigin {
  if (origin === 'library') return citations.length > 0 && citations.every((c) => c.kind === 'chunk') ? 'library' : 'synthesis';
  if (origin === 'user_content') return citations.every((c) => c.kind === 'highlight' || c.kind === 'note') ? 'user_content' : 'synthesis';
  if (origin === 'broader') return citations.length === 0 ? 'broader' : 'synthesis';
  return origin;
}

/** Validate one segment; null means a scope violation. */
export function validateSegment(context: VerifiedContext, raw: RawSegment): GatewaySegment | null {
  if (!SEGMENT_ORIGINS.includes(raw.origin as SegmentOrigin)) return null;
  const citations: GatewayCitation[] = [];
  for (const c of raw.citations) {
    const valid = citationFor(context, c.ref, c.anchor);
    if (!valid) return null;
    citations.push(valid);
  }
  return { origin: originAfterRules(raw.origin as SegmentOrigin, citations), text: raw.text, citations };
}

export function enforceCitations(
  context: VerifiedContext,
  raw: readonly RawSegment[],
  toolCalls: readonly { name: string; bookId: string }[],
): CitationOutcome {
  const badTool = toolCalls.some((t) => !context.allowedBookIds.includes(t.bookId));
  const segments: GatewaySegment[] = [];
  let relabelled = 0;
  for (const r of raw) {
    const s = validateSegment(context, r);
    if (!s) return { segments: [], scopeViolation: true, relabelled: 0 };
    if (s.origin !== r.origin) relabelled++;
    segments.push(s);
  }
  if (badTool) return { segments: [], scopeViolation: true, relabelled: 0 };
  return { segments, scopeViolation: false, relabelled };
}
