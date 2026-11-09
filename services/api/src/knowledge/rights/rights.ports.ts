/**
 * Rights-layer ports. NEM-019 ships NO production adapters for either; the
 * default bindings answer `unknown`, and `unknown` denies.
 */

/** ADR-002 entitlement of a user to a licensed book (B-4). */
export type OwnershipAnswer = 'entitled' | 'not_entitled' | 'unknown';

export interface OwnershipPort {
  check(userId: string, bookId: string): Promise<OwnershipAnswer>;
}
export const OWNERSHIP_PORT = Symbol('OWNERSHIP_PORT');

export class UnboundOwnershipPort implements OwnershipPort {
  async check(): Promise<OwnershipAnswer> {
    return 'unknown';
  }
}

/**
 * Identity of the stored text a book currently serves (07 §3 "Text identity").
 * Book text lives in object storage, so the hash is supplied by a port; a
 * record for any other textHash is stale and denied.
 */
export interface TextIdentityPort {
  currentTextHash(bookId: string): Promise<string | null>;
}
export const TEXT_IDENTITY_PORT = Symbol('TEXT_IDENTITY_PORT');

export class UnboundTextIdentityPort implements TextIdentityPort {
  async currentTextHash(): Promise<string | null> {
    return null;
  }
}
