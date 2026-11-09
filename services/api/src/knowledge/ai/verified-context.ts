import { ModelPathId } from './model-paths';

const VERIFIED = Symbol('knowledge.verified-context');

export type ContextItemKind = 'chunk' | 'highlight' | 'note';

/** A reference to a context item. Fixtures only in NEM-019; never logged. */
export interface ContextItem {
  kind: ContextItemKind;
  ref: string;
  bookId: string | null;
  /** Owner of a highlight or note. */
  userId?: string;
}

/** Context that has passed a declared invariant. Only a Context Builder seals it. */
export interface VerifiedContext {
  readonly [VERIFIED]: true;
  readonly pathId: ModelPathId;
  readonly invariant: string;
  readonly userId: string;
  readonly allowedBookIds: readonly string[];
  readonly items: readonly ContextItem[];
}

/**
 * Seal a context. An architecture test restricts callers of this function to
 * Context Builders, so the Gateway can trust a sealed context.
 */
export function sealContext(c: Omit<VerifiedContext, typeof VERIFIED>): VerifiedContext {
  return Object.freeze({
    ...c,
    allowedBookIds: Object.freeze([...c.allowedBookIds]),
    items: Object.freeze(c.items.map((i) => Object.freeze({ ...i }))),
    [VERIFIED]: true as const,
  });
}

export function isVerifiedContext(c: unknown): c is VerifiedContext {
  return typeof c === 'object' && c !== null && (c as Record<symbol, unknown>)[VERIFIED] === true;
}
