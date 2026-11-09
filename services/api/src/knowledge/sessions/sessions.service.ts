import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { IntelligenceDenied } from '../common/intelligence-denied.error';
import { KnowledgeDbService } from '../common/knowledge-db.service';
import { KnowledgeMetricsService } from '../common/knowledge-metrics.service';
import { EntitlementService, Resolution } from '../entitlement/entitlement.service';
import { RESEARCH_OPERATION, RESEARCH_SESSION } from '../knowledge.types';
import { RightsService } from '../rights/rights.service';

export interface SessionRow {
  id: string;
  userId: string;
  parentId: string | null;
  contextParentId: string | null;
  status: 'active' | 'read_only';
  readOnlyReason: string | null;
  tierAtCreation: string;
  lockedAt: Date | null;
  bookSetHash: string | null;
  turnCount: number;
}

export interface SessionBookRow {
  id: string;
  bookId: string | null;
  position: number;
  titleSnapshot: string;
  authorSnapshot: string;
}

/** Customer-facing view. No tier names, model names, or internal keys. */
export interface SessionView {
  id: string;
  parentId: string | null;
  inheritsParentContext: boolean;
  status: 'active' | 'read_only';
  locked: boolean;
  turnCount: number;
  books: { bookId: string | null; position: number; title: string; author: string }[];
  forkOffer: { maxBooks: number } | null;
}

/** Hash of the set's row identities (stable even if a book is later deleted). */
export function bookSetHash(books: Pick<SessionBookRow, 'id' | 'position'>[]): string {
  const canonical = [...books].sort((a, b) => a.position - b.position).map((b) => `${b.position}:${b.id}`).join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

type Allowed = Extract<Resolution, { allowed: true }>;

/**
 * Research sessions (ADR-006). Limits come from the resolver only; every
 * selected book counts, including public domain (PO-027 rule 3). Selection
 * changes run in a short transaction holding SELECT … FOR UPDATE on the
 * session row. A locked set never changes; changes need a new or forked session.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly db: KnowledgeDbService,
    private readonly entitlements: EntitlementService,
    private readonly rights: RightsService,
    private readonly metrics: KnowledgeMetricsService,
  ) {}

  async resolveOrDeny(userId: string): Promise<Allowed> {
    const r = await this.entitlements.resolve(userId, RESEARCH_SESSION);
    if (!r.allowed) throw new IntelligenceDenied(r.reason);
    return r;
  }

  async create(userId: string, bookIds: string[] = []): Promise<SessionView> {
    const r = await this.resolveOrDeny(userId);
    const books = await this.validateSelection(userId, bookIds, r);
    const id = await this.db.transaction(async (m) => {
      const [s] = await m.query(
        `INSERT INTO ai_conversations ("userId", "tierAtCreation", "policyVersionAtCreation")
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, r.tier, r.policy.version],
      );
      await this.insertBooks(m, s.id, books);
      return s.id as string;
    });
    return this.get(userId, id);
  }

  async addBook(userId: string, sessionId: string, bookId: string): Promise<SessionView> {
    const r = await this.resolveOrDeny(userId);
    const [book] = await this.validateSelection(userId, [bookId], r);
    await this.db.transaction(async (m) => {
      const session = await this.lockOwned(m, userId, sessionId);
      this.assertEditable(session);
      const rows = await this.books(m, sessionId);
      if (rows.some((b) => b.bookId === bookId)) throw new IntelligenceDenied('duplicate_book');
      if (rows.length >= r.limits.maxBooks) {
        this.metrics.limitRejectedInc(r.tier);
        throw new IntelligenceDenied('limit_reached');
      }
      const used = new Set(rows.map((b) => b.position));
      let position = 1;
      while (used.has(position)) position++;
      await m.query(
        `INSERT INTO ai_session_books ("sessionId", "bookId", position, "titleSnapshot", "authorSnapshot")
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, book.id, position, book.title, book.author],
      );
      await m.query(`UPDATE ai_conversations SET "updatedAt" = now() WHERE id = $1`, [sessionId]);
    });
    return this.get(userId, sessionId);
  }

  async removeBook(userId: string, sessionId: string, bookId: string): Promise<SessionView> {
    await this.resolveOrDeny(userId);
    await this.db.transaction(async (m) => {
      const session = await this.lockOwned(m, userId, sessionId);
      this.assertEditable(session);
      const res = await m.query(
        `DELETE FROM ai_session_books WHERE "sessionId" = $1 AND "bookId" = $2 RETURNING id`,
        [sessionId, bookId],
      );
      if (res.length === 0) throw new IntelligenceDenied('not_found');
    });
    return this.get(userId, sessionId);
  }

  /**
   * Fork: a new session with a parent reference; the parent stays immutable.
   * Generated context carries only if the parent's books are a subset of the
   * fork's AND every parent book is still eligible (ADR-006).
   */
  async fork(userId: string, parentId: string, bookIds: string[]): Promise<SessionView> {
    const r = await this.resolveOrDeny(userId);
    const parentRows = await this.db.query<{ id: string }>(
      `SELECT id FROM ai_conversations WHERE id = $1 AND "userId" = $2`,
      [parentId, userId],
    );
    if (parentRows.length === 0) throw new IntelligenceDenied('not_found');
    const books = await this.validateSelection(userId, bookIds, r);
    const parentBooks = await this.db.query<SessionBookRow>(
      `SELECT id, "bookId", position, "titleSnapshot", "authorSnapshot" FROM ai_session_books WHERE "sessionId" = $1`,
      [parentId],
    );
    const forkSet = new Set(bookIds);
    let carry = parentBooks.every((b) => b.bookId !== null && forkSet.has(b.bookId));
    for (const b of parentBooks) {
      if (!carry) break;
      const e = await this.rights.eligibility(userId, b.bookId as string, RESEARCH_OPERATION);
      carry = e.eligible;
    }
    const id = await this.db.transaction(async (m) => {
      const [s] = await m.query(
        `INSERT INTO ai_conversations ("userId", "parentId", "contextParentId", "tierAtCreation", "policyVersionAtCreation")
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [userId, parentId, carry ? parentId : null, r.tier, r.policy.version],
      );
      await this.insertBooks(m, s.id, books);
      return s.id as string;
    });
    return this.get(userId, id);
  }

  /**
   * History read. Never requires entitlement (history is never removed by a
   * downgrade). If the caller is still entitled but the set exceeds the current
   * limit, the session becomes read_only and a fork is offered (ADR-006).
   */
  async get(userId: string, sessionId: string): Promise<SessionView> {
    const rows = await this.db.query<SessionRow>(
      `SELECT * FROM ai_conversations WHERE id = $1 AND "userId" = $2`,
      [sessionId, userId],
    );
    let session = rows[0];
    if (!session) throw new IntelligenceDenied('not_found');
    const books = await this.db.query<SessionBookRow>(
      `SELECT id, "bookId", position, "titleSnapshot", "authorSnapshot" FROM ai_session_books
        WHERE "sessionId" = $1 ORDER BY position`,
      [sessionId],
    );
    const r = await this.entitlements.resolve(userId, RESEARCH_SESSION);
    let forkOffer: SessionView['forkOffer'] = null;
    if (r.allowed && books.length > r.limits.maxBooks) {
      if (session.status === 'active') session = await this.markOverLimit(sessionId);
      forkOffer = { maxBooks: r.limits.maxBooks };
    }
    return {
      id: session.id,
      parentId: session.parentId,
      inheritsParentContext: session.contextParentId !== null,
      status: session.status,
      locked: session.lockedAt !== null,
      turnCount: Number(session.turnCount),
      books: books.map((b) => ({ bookId: b.bookId, position: Number(b.position), title: b.titleSnapshot, author: b.authorSnapshot })),
      forkOffer,
    };
  }

  /** Mark a session read_only because its set exceeds the tier limit. History is kept. */
  async markOverLimit(sessionId: string, m?: EntityManager): Promise<SessionRow> {
    const run = (q: string, p: unknown[]) => (m ? m.query(q, p) : this.db.query(q, p));
    const [row] = await run(
      `UPDATE ai_conversations SET status = 'read_only', "readOnlyReason" = 'over_tier_limit', "updatedAt" = now()
        WHERE id = $1 RETURNING *`,
      [sessionId],
    );
    return row;
  }

  async lockOwned(m: EntityManager, userId: string, sessionId: string): Promise<SessionRow> {
    const rows = await m.query(
      `SELECT * FROM ai_conversations WHERE id = $1 AND "userId" = $2 FOR UPDATE`,
      [sessionId, userId],
    );
    if (rows.length === 0) throw new IntelligenceDenied('not_found');
    return rows[0];
  }

  books(m: EntityManager | KnowledgeDbService, sessionId: string): Promise<SessionBookRow[]> {
    return (m as KnowledgeDbService).query<SessionBookRow>(
      `SELECT id, "bookId", position, "titleSnapshot", "authorSnapshot" FROM ai_session_books
        WHERE "sessionId" = $1 ORDER BY position`,
      [sessionId],
    );
  }

  private assertEditable(s: SessionRow) {
    if (s.status === 'read_only') throw new IntelligenceDenied('session_read_only');
    if (s.lockedAt) throw new IntelligenceDenied('session_locked');
  }

  /** Ignore everything the client sends except book ids. */
  private async validateSelection(
    userId: string, bookIds: string[], r: Allowed,
  ): Promise<{ id: string; title: string; author: string }[]> {
    if (!Array.isArray(bookIds)) throw new IntelligenceDenied('invalid_request');
    if (new Set(bookIds).size !== bookIds.length) throw new IntelligenceDenied('duplicate_book');
    if (bookIds.length > r.limits.maxBooks) {
      this.metrics.limitRejectedInc(r.tier);
      throw new IntelligenceDenied('limit_reached');
    }
    if (bookIds.length === 0) return [];
    const found = await this.db.query<{ id: string; title: string; author: string }>(
      `SELECT id, title, author FROM books WHERE id = ANY($1::uuid[])`,
      [bookIds],
    );
    const byId = new Map(found.map((b) => [b.id, b]));
    const out: { id: string; title: string; author: string }[] = [];
    for (const id of bookIds) {
      const book = byId.get(id);
      if (!book) throw new IntelligenceDenied('book_ineligible');
      const e = await this.rights.eligibility(userId, id, RESEARCH_OPERATION);
      if (!e.eligible) throw new IntelligenceDenied('book_ineligible');
      out.push(book);
    }
    return out;
  }

  private async insertBooks(m: EntityManager, sessionId: string, books: { id: string; title: string; author: string }[]) {
    let position = 1;
    for (const b of books) {
      await m.query(
        `INSERT INTO ai_session_books ("sessionId", "bookId", position, "titleSnapshot", "authorSnapshot")
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, b.id, position++, b.title, b.author],
      );
    }
  }
}
