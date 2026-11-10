import { KnowledgeDbService } from '../common/knowledge-db.service';
import { TextIdentityPort } from '../rights/rights.ports';
import { chunkIdFromRef, citationAnchor } from './retrieval.types';

export interface ResolvedAnchor {
  bookId: string;
  textHash: string;
  charStart: number;
  charEnd: number;
  /** Null in Stage 1 (Amendment 1, B-2). */
  chapterLabel: string | null;
  /** Null in Stage 1 (Amendment 1, B-2). */
  phraseRange: { start: number; end: number } | null;
  /** `textHash:charStart-charEnd`, as carried by Gateway citations. */
  anchor: string;
}

/**
 * NEM-023 §5.8 — chunk ref → anchor. The ref resolves only while the chunk's hash equals the book's CURRENT text hash
 * from `TextIdentityPort`; otherwise (text replaced, unknown identity, unknown ref) it is unresolvable (null).
 */
export class AnchorResolver {
  constructor(private readonly db: KnowledgeDbService, private readonly textIdentity: TextIdentityPort) {}

  async resolve(ref: string): Promise<ResolvedAnchor | null> {
    const id = chunkIdFromRef(ref);
    if (!id) return null;
    const [c] = await this.db.query<{ bookId: string; textHash: string; charStart: number; charEnd: number; chapterLabel: string | null; phraseIndexStart: number | null; phraseIndexEnd: number | null }>(
      `SELECT "bookId", "textHash", "charStart", "charEnd", "chapterLabel", "phraseIndexStart", "phraseIndexEnd" FROM ai_book_chunks WHERE id = $1`, [id],
    );
    if (!c) return null;
    let current: string | null;
    try {
      current = await this.textIdentity.currentTextHash(c.bookId);
    } catch {
      current = null;
    }
    if (!current || current !== c.textHash) return null;
    const charStart = Number(c.charStart);
    const charEnd = Number(c.charEnd);
    return {
      bookId: c.bookId, textHash: c.textHash, charStart, charEnd, chapterLabel: c.chapterLabel,
      phraseRange: c.phraseIndexStart === null || c.phraseIndexEnd === null ? null : { start: Number(c.phraseIndexStart), end: Number(c.phraseIndexEnd) },
      anchor: citationAnchor({ textHash: c.textHash, charStart, charEnd }),
    };
  }
}
