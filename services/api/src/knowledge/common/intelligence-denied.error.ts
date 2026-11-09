import { HttpException, HttpStatus } from '@nestjs/common';
import { DenialReason } from '../knowledge.types';

const STATUS: Record<DenialReason, HttpStatus> = {
  prerequisite_missing: HttpStatus.FORBIDDEN,
  no_entitlement: HttpStatus.FORBIDDEN,
  policy_missing: HttpStatus.FORBIDDEN,
  capability_not_in_tier: HttpStatus.FORBIDDEN,
  feature_disabled: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  session_locked: HttpStatus.CONFLICT,
  session_read_only: HttpStatus.CONFLICT,
  limit_reached: HttpStatus.UNPROCESSABLE_ENTITY,
  duplicate_book: HttpStatus.CONFLICT,
  book_ineligible: HttpStatus.FORBIDDEN,
  no_eligible_books: HttpStatus.FORBIDDEN,
  budget_exhausted: HttpStatus.TOO_MANY_REQUESTS,
  budget_unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  unresolved_reservations: HttpStatus.SERVICE_UNAVAILABLE,
  scope_violation: HttpStatus.INTERNAL_SERVER_ERROR,
  duplicate_turn: HttpStatus.CONFLICT,
  set_changed: HttpStatus.CONFLICT,
  turn_failed: HttpStatus.BAD_GATEWAY,
  invalid_request: HttpStatus.BAD_REQUEST,
};

/** Safe, customer-neutral messages. No model names, no internal detail. */
const MESSAGE: Record<DenialReason, string> = {
  prerequisite_missing: 'An active book subscription is required.',
  no_entitlement: 'This feature is not available on your account.',
  policy_missing: 'This feature is not available right now.',
  capability_not_in_tier: 'This feature is not available on your account.',
  feature_disabled: 'This feature is not available right now.',
  not_found: 'Not found.',
  session_locked: 'This session is locked. Start a new or forked session to change books.',
  session_read_only: 'This session is read-only. You can fork it to continue.',
  limit_reached: 'This session has reached its book limit.',
  duplicate_book: 'This book is already selected.',
  book_ineligible: 'This book is not available for research.',
  no_eligible_books: 'No selected book is available for research.',
  budget_exhausted: 'Your usage allowance for this feature is used up.',
  budget_unavailable: 'This feature is temporarily unavailable.',
  unresolved_reservations: 'This feature is temporarily unavailable.',
  scope_violation: 'Something went wrong. Try again.',
  duplicate_turn: 'This request was already submitted.',
  set_changed: 'The selected books changed. Try again.',
  turn_failed: 'Something went wrong. Try again.',
  invalid_request: 'Invalid request.',
};

/** The only error type the intelligence control plane surfaces to clients. */
export class IntelligenceDenied extends HttpException {
  constructor(readonly reason: DenialReason) {
    super({ code: reason, message: MESSAGE[reason] }, STATUS[reason]);
  }
}
