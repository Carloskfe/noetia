import { Inject, Injectable } from '@nestjs/common';
import { KnowledgeDbService } from '../common/knowledge-db.service';
import {
  OWNERSHIP_PORT,
  OwnershipPort,
  RIGHTS_VERIFICATION_AUTHORITY_PORT,
  RightsVerificationAuthorityPort,
  TEXT_IDENTITY_PORT,
  TextIdentityPort,
} from './rights.ports';

export interface RightsRecord {
  status: string;
  textHash: string;
  workTitle: string | null;
  workAuthors: string[] | null;
  authorDeathDate: string | Date | null;
  firstPublicationDate: string | null;
  edition: string | null;
  editionPublisher: string | null;
  editionYear: number | null;
  textSource: string | null;
  isTranslation: boolean | null;
  translators: string[] | null;
  translatorDeathDate: string | Date | null;
  translationDate: string | null;
  addedMaterial: string | null;
  sourceUrl: string | null;
  rightsBasis: 'public_domain' | 'rights_holder_opt_in' | 'licensed' | null;
  rightsEvidence: string | null;
  jurisdiction: string | null;
  permittedOperations: string[] | null;
  verifier: string | null;
  verifiedAt: string | Date | null;
  evidenceLinks: string[] | null;
  reviewDate: string | Date | null;
}

export type IneligibleReason =
  | 'text_identity_unknown'
  | 'no_rights_record'
  | 'not_verified'
  | 'incomplete_record'
  | 'malformed_record'
  | 'not_attested'
  | 'operation_not_permitted'
  | 'review_expired'
  | 'not_entitled';

export type Eligibility =
  | { eligible: true; basis: 'public_domain' | 'entitlement' }
  | { eligible: false; reason: IneligibleReason };

const present = (v: unknown) =>
  v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === '') && !(Array.isArray(v) && v.length === 0);

/**
 * True when every 07 §3 element is present. Public-domain records must also
 * carry the author's death date and, for a translation, the translator's death
 * date and translation date, because those dates are the basis of the claim.
 */
export function isCompleteRecord(r: RightsRecord): boolean {
  const always: unknown[] = [
    r.workTitle, r.workAuthors, r.firstPublicationDate, r.edition, r.editionPublisher, r.editionYear,
    r.textSource, r.addedMaterial, r.textHash, r.sourceUrl, r.rightsBasis, r.rightsEvidence,
    r.jurisdiction, r.permittedOperations, r.verifier, r.verifiedAt, r.evidenceLinks, r.reviewDate,
  ];
  if (!always.every(present) || r.isTranslation === null || r.isTranslation === undefined) return false;
  if (r.isTranslation && !present(r.translators)) return false;
  if (r.rightsBasis === 'public_domain') {
    if (!present(r.authorDeathDate)) return false;
    if (r.isTranslation && (!present(r.translatorDeathDate) || !present(r.translationDate))) return false;
  }
  return true;
}

const validDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const isHttpUrl = (v: unknown) => {
  if (typeof v !== 'string') return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

/**
 * F-12: values that are present but malformed cannot grant eligibility.
 * Dates must parse and be coherent (no verification in the future, review
 * after verification, death dates not in the future); the edition year must be
 * plausible; the source and every evidence link must be http(s) URLs; operations
 * and the text hash must be non-blank tokens. This checks FORM only — it is not
 * a judgement on the authenticity or legal sufficiency of the evidence.
 */
export function isWellFormedRecord(r: RightsRecord, now = new Date()): boolean {
  const verifiedAt = validDate(r.verifiedAt);
  const review = validDate(r.reviewDate);
  if (!verifiedAt || !review) return false;
  if (verifiedAt.getTime() > now.getTime()) return false;
  if (review.getTime() < new Date(verifiedAt.toISOString().slice(0, 10)).getTime()) return false;
  for (const d of [r.authorDeathDate, r.translatorDeathDate]) {
    if (d === null || d === undefined) continue;
    const parsed = validDate(d);
    if (!parsed || parsed.getTime() > now.getTime()) return false;
  }
  if (!Number.isInteger(Number(r.editionYear)) || Number(r.editionYear) < 1 || Number(r.editionYear) > now.getUTCFullYear()) return false;
  if (!isHttpUrl(r.sourceUrl) || !(r.evidenceLinks ?? []).every(isHttpUrl)) return false;
  if (!(r.permittedOperations ?? []).every((o) => typeof o === 'string' && /^[a-z][a-z0-9_]*$/.test(o))) return false;
  if (typeof r.textHash !== 'string' || /\s/.test(r.textHash)) return false;
  return true;
}

/**
 * Eligibility resolver (ADR-006, B-4). DEFAULT DENY.
 * Eligible = a verified, complete, well-formed, current-text rights record
 * permitting the operation, ATTESTED by the verification authority (F-12), AND
 * an access basis: a public-domain edition (no library entry
 * needed, PO-027 rule 4) or entitlement to a licensed book via OwnershipPort.
 * Ownership never makes a book AI-eligible (PO-027 rule 8). `isFree` and other
 * catalogue metadata are never read here.
 */
@Injectable()
export class RightsService {
  constructor(
    private readonly db: KnowledgeDbService,
    @Inject(OWNERSHIP_PORT) private readonly ownership: OwnershipPort,
    @Inject(TEXT_IDENTITY_PORT) private readonly textIdentity: TextIdentityPort,
    @Inject(RIGHTS_VERIFICATION_AUTHORITY_PORT) private readonly authority: RightsVerificationAuthorityPort,
  ) {}

  async eligibility(userId: string, bookId: string, operation: string, now = new Date()): Promise<Eligibility> {
    let hash: string | null;
    try {
      hash = await this.textIdentity.currentTextHash(bookId);
    } catch {
      hash = null;
    }
    if (!hash) return { eligible: false, reason: 'text_identity_unknown' };

    const rows = await this.db.query<RightsRecord>(
      `SELECT * FROM book_ai_rights WHERE "bookId" = $1 AND "textHash" = $2`,
      [bookId, hash],
    );
    const r = rows[0];
    if (!r) return { eligible: false, reason: 'no_rights_record' };
    if (r.status !== 'verified') return { eligible: false, reason: 'not_verified' };
    if (!isCompleteRecord(r)) return { eligible: false, reason: 'incomplete_record' };
    if (!isWellFormedRecord(r, now)) return { eligible: false, reason: 'malformed_record' };
    if (!(r.permittedOperations ?? []).includes(operation)) return { eligible: false, reason: 'operation_not_permitted' };
    if (r.reviewDate && new Date(r.reviewDate).getTime() < now.getTime()) {
      return { eligible: false, reason: 'review_expired' };
    }

    // F-12 trust boundary: a complete, well-formed `verified` row is still only
    // data. It grants nothing unless the verification authority attests it.
    let attestation;
    try {
      attestation = await this.authority.attest({
        bookId, textHash: r.textHash, verifier: r.verifier, verifiedAt: r.verifiedAt, evidenceLinks: r.evidenceLinks,
      });
    } catch {
      attestation = 'unknown';
    }
    if (attestation !== 'attested') return { eligible: false, reason: 'not_attested' };

    if (r.rightsBasis === 'public_domain') return { eligible: true, basis: 'public_domain' };

    let answer;
    try {
      answer = await this.ownership.check(userId, bookId);
    } catch {
      answer = 'unknown';
    }
    return answer === 'entitled' ? { eligible: true, basis: 'entitlement' } : { eligible: false, reason: 'not_entitled' };
  }
}
