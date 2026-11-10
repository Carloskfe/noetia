import { KnowledgeDbService } from '../common/knowledge-db.service';
import { RightsVerificationAuthorityPort, TextIdentityPort } from '../rights/rights.ports';
import { isCompleteRecord, isWellFormedRecord, RightsRecord } from '../rights/rights.service';

/** NEM-023 §9.6 / D-6: the explicit, book-level grant to create and keep an index of one exact text version. */
export const RETRIEVAL_INDEXING_OPERATION = 'retrieval_indexing';

export type IndexingDenialReason =
  | 'text_identity_unknown'
  | 'no_rights_record'
  | 'not_verified'
  | 'incomplete_record'
  | 'malformed_record'
  | 'operation_not_permitted'
  | 'review_expired'
  | 'not_attested';

export type IndexingDecision = { permitted: true; textHash: string } | { permitted: false; reason: IndexingDenialReason };

/**
 * Book-level index permission (C-1). DEFAULT DENY.
 *
 * Evaluates only NEM-019's book-level steps, from the same sources, reusing NEM-019's exported validators:
 * current hash from `TextIdentityPort` → the `book_ai_rights` row for that hash → `verified` + complete + well formed →
 * `retrieval_indexing` granted → review date not past → attested by `RightsVerificationAuthorityPort`.
 *
 * It has NO user identity: it never calls `RightsService.eligibility` or the ownership port, and never fabricates a
 * user (architecture test). Index permission never makes a book usable; ownership never makes a book indexable.
 */
export class IndexingPermission {
  constructor(
    private readonly db: KnowledgeDbService,
    private readonly textIdentity: TextIdentityPort,
    private readonly authority: RightsVerificationAuthorityPort,
  ) {}

  async check(bookId: string, now = new Date()): Promise<IndexingDecision> {
    let hash: string | null;
    try {
      hash = await this.textIdentity.currentTextHash(bookId);
    } catch {
      hash = null;
    }
    if (!hash) return { permitted: false, reason: 'text_identity_unknown' };

    let r: RightsRecord | undefined;
    try {
      [r] = await this.db.query<RightsRecord>(`SELECT * FROM book_ai_rights WHERE "bookId" = $1 AND "textHash" = $2`, [bookId, hash]);
    } catch {
      return { permitted: false, reason: 'no_rights_record' };
    }
    if (!r) return { permitted: false, reason: 'no_rights_record' };
    if (r.status !== 'verified') return { permitted: false, reason: 'not_verified' };
    if (!isCompleteRecord(r)) return { permitted: false, reason: 'incomplete_record' };
    if (!isWellFormedRecord(r, now)) return { permitted: false, reason: 'malformed_record' };
    if (!(r.permittedOperations ?? []).includes(RETRIEVAL_INDEXING_OPERATION)) return { permitted: false, reason: 'operation_not_permitted' };
    if (r.reviewDate && new Date(r.reviewDate).getTime() < now.getTime()) return { permitted: false, reason: 'review_expired' };

    let attestation: string;
    try {
      attestation = await this.authority.attest({
        bookId, textHash: r.textHash, verifier: r.verifier, verifiedAt: r.verifiedAt, evidenceLinks: r.evidenceLinks,
      });
    } catch {
      attestation = 'unknown';
    }
    if (attestation !== 'attested') return { permitted: false, reason: 'not_attested' };
    return { permitted: true, textHash: hash };
  }
}
