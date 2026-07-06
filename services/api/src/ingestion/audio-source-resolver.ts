// Pure helpers for migrate-audio-to-minio.ts — resolving where a book's audio
// lives (archive.org, directly or via its LibriVox page) so it can be pulled
// into our own MinIO storage. Kept side-effect-free for unit testing; the
// network calls live in the migration script.

/**
 * True when a book still needs migrating: it has no stream key, or the key is an
 * external http(s) URL. A MinIO object key (e.g. "books/foo-audio.mp3") is not a
 * URL, so it is considered already migrated and skipped (makes the run idempotent).
 */
export function needsMigration(key: string | null | undefined): boolean {
  if (!key) return true;
  return /^https?:\/\//i.test(key);
}

/** Extract the archive.org item identifier from a details/ or download/ URL. */
export function parseArchiveIdentifier(url: string): string | null {
  const m = /archive\.org\/(?:details|download)\/([^/?#"']+)/i.exec(url);
  return m ? m[1] : null;
}

/** Find an archive.org item identifier referenced anywhere on a LibriVox page. */
export function archiveIdFromLibrivoxHtml(html: string): string | null {
  const m = /archive\.org\/(?:details|download)\/([a-z0-9_.-]+)/i.exec(html);
  return m ? m[1] : null;
}

/** Sort chapter filenames by the first run of digits (chapter order). */
export function sortByChapterNumber(files: string[]): string[] {
  return [...files].sort((a, b) => {
    const na = parseInt(/\d+/.exec(a)?.[0] ?? '0', 10);
    const nb = parseInt(/\d+/.exec(b)?.[0] ?? '0', 10);
    return na - nb;
  });
}

/**
 * From an archive.org item directory listing (HTML), pick the per-chapter MP3s
 * in chapter order. Prefer 64kb (smallest), then 128kb, then any .mp3 that is
 * not one of those derivatives — never the whole-book zip.
 */
export function pickChapterMp3s(html: string): string[] {
  const all64 = [...html.matchAll(/href="([^"]+_64kb\.mp3)"/gi)].map((m) => m[1]);
  const all128 = [...html.matchAll(/href="([^"]+_128kb\.mp3)"/gi)].map((m) => m[1]);
  const allMp3 = [...html.matchAll(/href="([^"]+\.mp3)"/gi)]
    .map((m) => m[1])
    .filter((f) => !f.includes('_128kb') && !f.includes('_64kb'));
  const candidates = all64.length ? all64 : all128.length ? all128 : allMp3;
  return sortByChapterNumber(candidates);
}

/** Deterministic MinIO object key for a book's concatenated audio. */
export function minioAudioKey(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `books/${slug}-audio.mp3`;
}

export interface AudioCandidate {
  audioStreamKey: string | null;
  audioFileKey: string | null;
}

/**
 * Decide how to source a book's audio. Returns either an archive.org identifier
 * we can parse directly, or a LibriVox page URL to scrape for one, or null when
 * there is no resolvable external source. Prefers an existing archive.org key
 * (no extra fetch); falls back to a LibriVox page (stream key first, then file
 * key).
 */
export function resolveAudioSource(
  book: AudioCandidate,
): { kind: 'archive'; identifier: string } | { kind: 'librivox'; pageUrl: string } | null {
  for (const key of [book.audioStreamKey, book.audioFileKey]) {
    if (key && /archive\.org/i.test(key)) {
      const id = parseArchiveIdentifier(key);
      if (id) return { kind: 'archive', identifier: id };
    }
  }
  for (const key of [book.audioStreamKey, book.audioFileKey]) {
    if (key && /librivox\.org/i.test(key)) {
      return { kind: 'librivox', pageUrl: key };
    }
  }
  return null;
}
