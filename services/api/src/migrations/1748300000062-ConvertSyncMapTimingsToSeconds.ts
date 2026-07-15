import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix the sync-map units bug: the legacy chapter-linear alignment path
 * (alignment.service.ts) stored phrase startTime/endTime in MILLISECONDS, while
 * the reader (audio.currentTime) and the whisper/SRT paths use SECONDS. That
 * made Escucha Activa ~1000× off on every affected book — the highlight barely
 * advanced and "pick where you're reading" seeked past the end of the audio.
 *
 * The code fix (emit seconds) only helps freshly-aligned maps; this migration
 * corrects the existing rows. A sync map is in milliseconds iff it is NOT a
 * whisper map AND its largest endTime exceeds 86_400 — no real audiobook is
 * 24h+ in seconds, but every affected ms map here is ≥ 420_000. Rows already in
 * seconds (whisper maps, short/zero-timing auto maps) are left untouched, which
 * also makes this migration idempotent if it were ever re-run.
 *
 * Not undoable: `down` is a no-op — multiplying back by 1000 would re-break
 * playback (and would wrongly hit maps that were always in seconds).
 */
export class ConvertSyncMapTimingsToSeconds1748300000062 implements MigrationInterface {
  name = 'ConvertSyncMapTimingsToSeconds1748300000062';

  async up(runner: QueryRunner): Promise<void> {
    const rows: Array<{ id: string; syncSource: string | null; phrases: unknown }> =
      await runner.query(`SELECT id, "syncSource", phrases FROM sync_maps`);

    let converted = 0;
    for (const row of rows) {
      if (row.syncSource === 'whisper') continue;
      const phrases = Array.isArray(row.phrases) ? row.phrases : [];
      if (!phrases.length) continue;

      const maxEnd = phrases.reduce(
        (m: number, p: { endTime?: number }) => Math.max(m, Number(p.endTime) || 0),
        0,
      );
      if (maxEnd <= 86_400) continue; // already seconds (or no real timings)

      const rescaled = phrases.map((p: { startTime?: number; endTime?: number }) => ({
        ...p,
        startTime: (Number(p.startTime) || 0) / 1000,
        endTime: (Number(p.endTime) || 0) / 1000,
      }));

      await runner.query(`UPDATE sync_maps SET phrases = $1 WHERE id = $2`, [
        JSON.stringify(rescaled),
        row.id,
      ]);
      converted++;
    }

    // Surfaced in migration logs so the deploy operator can confirm the count.
    // eslint-disable-next-line no-console
    console.log(`[ConvertSyncMapTimingsToSeconds] converted ${converted} ms sync map(s) to seconds`);
  }

  async down(): Promise<void> {
    // Intentional no-op — see class comment.
  }
}
