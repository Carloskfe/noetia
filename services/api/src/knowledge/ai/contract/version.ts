/**
 * NEM-021 shared provider contract — version policy.
 *
 * Contract v1 is the single, provider-neutral definition of capabilities,
 * usage, pricing, internal-unit weights, and attempt outcomes. It is shared by
 * the ledger (NEM-021 Phase 2) and the Gateway (NEM-022). Nothing outside this
 * module may redefine these schemas or implement pricing.
 *
 * Version policy:
 * - every serialized artifact carries `schemaVersion: 1`; validators reject any other value;
 * - after the Product Architecture checkpoint, v1 is frozen: changes are additive only (v1.x),
 *   must keep every existing fixture and golden vector valid, and must re-run both missions' suites;
 * - an incompatible change requires `schemaVersion: 2` and its own review.
 */
export const CONTRACT_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1 as const;
