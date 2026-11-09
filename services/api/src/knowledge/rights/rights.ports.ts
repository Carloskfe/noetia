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

/**
 * F-12 trust boundary. Confirms that a rights record was produced by the
 * AUTHORIZED verification process (verifier, evidence standard, and
 * jurisdiction under TT-26). A row in book_ai_rights is data anyone holding the
 * shared database role could write; it is not, by itself, proof of authority.
 *
 * NO production adapter exists (no authorized verification process exists
 * yet). The default binding answers `unknown`, and `unknown` denies.
 */
export type AttestationAnswer = 'attested' | 'not_attested' | 'unknown';

export interface RightsAttestationSubject {
  bookId: string;
  textHash: string;
  verifier: string | null;
  verifiedAt: string | Date | null;
  evidenceLinks: string[] | null;
}

export interface RightsVerificationAuthorityPort {
  attest(subject: RightsAttestationSubject): Promise<AttestationAnswer>;
}
export const RIGHTS_VERIFICATION_AUTHORITY_PORT = Symbol('RIGHTS_VERIFICATION_AUTHORITY_PORT');

export class UnboundRightsVerificationAuthority implements RightsVerificationAuthorityPort {
  async attest(): Promise<AttestationAnswer> {
    return 'unknown';
  }
}
