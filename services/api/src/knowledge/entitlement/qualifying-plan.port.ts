/**
 * ADR-005 prerequisite port. Answers whether a user holds an active qualifying
 * book subscription (Individual, Duo, or Family — PO-026).
 *
 * NEM-019 ships NO production adapter: mapping real subscriptions, linked
 * members, and states is a later mission (TT-15). The default binding answers
 * `unknown`, and `unknown` denies.
 */
export type QualifyingPlanAnswer = 'qualifying' | 'not_qualifying' | 'unknown';

export interface QualifyingPlanPort {
  check(userId: string): Promise<QualifyingPlanAnswer>;
}

export const QUALIFYING_PLAN_PORT = Symbol('QUALIFYING_PLAN_PORT');

export class UnboundQualifyingPlanPort implements QualifyingPlanPort {
  async check(): Promise<QualifyingPlanAnswer> {
    return 'unknown';
  }
}
