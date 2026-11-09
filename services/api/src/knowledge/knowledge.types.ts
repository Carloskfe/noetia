/**
 * NEM-019 shared types for the dark intelligence control plane.
 * Neutral naming: "intelligence", never "plus" in code identifiers.
 */

export type IntelligenceTier = 'noetia_plus' | 'noetia_x';

/** Higher rank wins when a user holds several grants. */
export const TIER_RANK: Record<IntelligenceTier, number> = { noetia_plus: 1, noetia_x: 2 };

/** Capability keys. Budget policies are keyed by tier AND capability (PO-028 rule 4). */
export type Capability = 'research_session' | (string & { readonly __capability?: never });
export const RESEARCH_SESSION: Capability = 'research_session';

/** The AI operation a research turn requires in a verified rights record (ADR-002). */
export const RESEARCH_OPERATION = 'research_analysis';

/** Machine-readable denial codes. Never include a model name or "Basic" here. */
export type DenialReason =
  | 'prerequisite_missing'
  | 'no_entitlement'
  | 'policy_missing'
  | 'capability_not_in_tier'
  | 'feature_disabled'
  | 'not_found'
  | 'session_locked'
  | 'session_read_only'
  | 'limit_reached'
  | 'duplicate_book'
  | 'book_ineligible'
  | 'no_eligible_books'
  | 'budget_exhausted'
  | 'budget_unavailable'
  | 'unresolved_reservations'
  | 'scope_violation'
  | 'duplicate_turn'
  | 'set_changed'
  | 'turn_failed'
  | 'invalid_request';

/** Answer-segment origins (ADR-003, extended by ADR-006 with user_content). */
export type SegmentOrigin = 'library' | 'synthesis' | 'broader' | 'user_content';
export const SEGMENT_ORIGINS: readonly SegmentOrigin[] = ['library', 'synthesis', 'broader', 'user_content'];
