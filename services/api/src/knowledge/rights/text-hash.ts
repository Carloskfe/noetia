import { createHash } from 'crypto';

/**
 * NEM-023 §9.1 — the single definition of a book's text identity.
 *
 * `textHash = "sha256:" + lowercase-hex(SHA-256(exact bytes of the MinIO object at books.textFileKey))`.
 * Byte-exact: no decoding, trimming, or Unicode normalization. Shared by the E5 indexer and retrieval, E3's future
 * `TextIdentityPort` adapter, and future rights manifests. An architecture test enforces this single definition.
 */
export const TEXT_HASH_PREFIX = 'sha256:';
export const TEXT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function computeTextHash(bytes: Uint8Array): string {
  return TEXT_HASH_PREFIX + createHash('sha256').update(bytes).digest('hex');
}
