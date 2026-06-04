import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserPersona, EngagementArchetype, ReadingCadence } from './user-persona.entity';

interface ThemeRow    { theme: string; cnt: string }
interface EventRow    { shares: string; creates: string }
interface PlatformRow { platform: string; cnt: string }
interface StatRow     { active_days: string; weekend_days: string; avg_minutes: string }
interface ProgressRow { phrase_index: number; total_phrases: number }
interface GenreRow    { category: string; fragment_count: string }

export interface PersonaInput {
  totalFragments: number;
  socialAmplification: number;
  avgFragmentsPerBook: number;
  clubDiscussions: number;
  activeDays: number;
  weekendDays: number;
  avgMinutes: number;
}

@Injectable()
export class PersonaComputerService {
  private readonly logger = new Logger(PersonaComputerService.name);

  constructor(
    private readonly ds: DataSource,
    @InjectRepository(UserPersona)
    private readonly personaRepo: Repository<UserPersona>,
  ) {}

  // ── Nightly recompute ──────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async computeAll(): Promise<void> {
    const rows: { user_id: string }[] = await this.ds.query(`
      SELECT DISTINCT user_id FROM (
        SELECT user_id FROM fragments
        UNION
        SELECT user_id FROM reading_stats
        UNION
        SELECT user_id FROM events WHERE user_id IS NOT NULL
      ) t
    `);

    this.logger.log(`Recomputing personas for ${rows.length} users`);
    let ok = 0;

    for (const { user_id } of rows) {
      try {
        await this.computeForUser(user_id);
        ok++;
      } catch (err: unknown) {
        this.logger.error(
          `Persona compute failed for ${user_id}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    this.logger.log(`Persona recompute complete: ${ok}/${rows.length} succeeded`);
  }

  // ── Per-user computation ───────────────────────────────────────────────────

  async computeForUser(userId: string): Promise<UserPersona> {
    const [
      dominantThemes,
      socialAmplification,
      preferredPlatforms,
      statRow,
      progressRows,
      topGenres,
      clubDiscussionCount,
      fragmentStats,
    ] = await Promise.all([
      this.queryDominantThemes(userId),
      this.querySocialAmplification(userId),
      this.queryPreferredPlatforms(userId),
      this.queryReadingStats(userId),
      this.queryProgressRows(userId),
      this.queryTopGenres(userId),
      this.queryClubDiscussions(userId),
      this.queryFragmentStats(userId),
    ]);

    const activeDays   = Number(statRow?.active_days ?? 0);
    const weekendDays  = Number(statRow?.weekend_days ?? 0);
    const avgMinutes   = Number(statRow?.avg_minutes ?? 0);

    const engagementArchetype = PersonaComputerService.computeArchetype({
      totalFragments:      fragmentStats.total,
      socialAmplification,
      avgFragmentsPerBook: fragmentStats.avgPerBook,
      clubDiscussions:     clubDiscussionCount,
      activeDays,
      weekendDays,
      avgMinutes,
    });

    const readingCadence = PersonaComputerService.computeCadence(
      activeDays, weekendDays, avgMinutes,
    );

    const completionRate = PersonaComputerService.computeCompletionRate(progressRows);

    const persona = this.personaRepo.create({
      userId,
      dominantThemes,
      engagementArchetype,
      readingCadence,
      completionRate,
      socialAmplification,
      preferredPlatforms,
      topGenres,
      avgSessionMinutes: activeDays > 0 ? avgMinutes : null,
    });

    await this.ds.query(
      `INSERT INTO user_personas
         (user_id, dominant_themes, engagement_archetype, reading_cadence,
          completion_rate, social_amplification, preferred_platforms,
          top_genres, avg_session_minutes, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         dominant_themes      = EXCLUDED.dominant_themes,
         engagement_archetype = EXCLUDED.engagement_archetype,
         reading_cadence      = EXCLUDED.reading_cadence,
         completion_rate      = EXCLUDED.completion_rate,
         social_amplification = EXCLUDED.social_amplification,
         preferred_platforms  = EXCLUDED.preferred_platforms,
         top_genres           = EXCLUDED.top_genres,
         avg_session_minutes  = EXCLUDED.avg_session_minutes,
         computed_at          = NOW()`,
      [
        userId,
        JSON.stringify(dominantThemes),
        engagementArchetype,
        readingCadence,
        completionRate,
        socialAmplification,
        JSON.stringify(preferredPlatforms),
        JSON.stringify(topGenres),
        activeDays > 0 ? avgMinutes : null,
      ],
    );

    return persona;
  }

  // ── Decision trees (static — directly testable) ────────────────────────────

  static computeArchetype(input: PersonaInput): EngagementArchetype {
    const { totalFragments, socialAmplification, avgFragmentsPerBook, clubDiscussions } = input;
    if (socialAmplification > 0.3)                           return 'social_sharer';
    if (clubDiscussions >= 5)                                 return 'community';
    if (totalFragments >= 10 && avgFragmentsPerBook >= 3)    return 'deep_reader';
    if (totalFragments < 3)                                   return 'browser';
    return 'reader';
  }

  static computeCadence(
    activeDays: number,
    weekendDays: number,
    avgMinutes: number,
  ): ReadingCadence {
    if (activeDays === 0) return 'irregular';
    const weekendRatio = weekendDays / activeDays;
    if (activeDays >= 40)                               return 'daily';
    if (weekendRatio >= 0.6)                            return 'weekend';
    if (activeDays <= 10 && avgMinutes >= 45)           return 'binge';
    return 'irregular';
  }

  static computeCompletionRate(
    rows: ProgressRow[],
  ): number | null {
    if (rows.length === 0) return null;
    const completed = rows.filter(
      (r) => r.total_phrases > 0 && r.phrase_index / r.total_phrases >= 0.8,
    ).length;
    return completed / rows.length;
  }

  // ── Raw SQL queries ─────────────────────────────────────────────────────────

  private async queryDominantThemes(userId: string): Promise<string[]> {
    const rows: ThemeRow[] = await this.ds.query(
      `SELECT theme, count(*) as cnt
       FROM fragments, jsonb_array_elements_text(themes) as theme
       WHERE user_id = $1 AND themes IS NOT NULL
       GROUP BY theme ORDER BY cnt::int DESC LIMIT 5`,
      [userId],
    );
    return rows.map((r) => r.theme);
  }

  private async querySocialAmplification(userId: string): Promise<number> {
    const rows: EventRow[] = await this.ds.query(
      `SELECT
         (SELECT count(*) FROM events WHERE user_id = $1 AND event_type = 'fragment_shared')  AS shares,
         (SELECT count(*) FROM events WHERE user_id = $1 AND event_type = 'fragment_created') AS creates`,
      [userId],
    );
    const shares  = Number(rows[0]?.shares ?? 0);
    const creates = Number(rows[0]?.creates ?? 0);
    return creates > 0 ? shares / creates : 0;
  }

  private async queryPreferredPlatforms(userId: string): Promise<string[]> {
    const rows: PlatformRow[] = await this.ds.query(
      `SELECT payload->>'platform' AS platform, count(*) AS cnt
       FROM events
       WHERE user_id = $1 AND event_type = 'fragment_shared'
         AND payload->>'platform' IS NOT NULL
       GROUP BY platform ORDER BY cnt::int DESC LIMIT 4`,
      [userId],
    );
    return rows.map((r) => r.platform);
  }

  private async queryReadingStats(userId: string): Promise<StatRow | null> {
    const rows: StatRow[] = await this.ds.query(
      `SELECT
         count(*)                                                                              AS active_days,
         count(*) FILTER (WHERE EXTRACT(DOW FROM date::date) IN (0, 6))                      AS weekend_days,
         coalesce(avg(minutes_read), 0)                                                       AS avg_minutes
       FROM reading_stats
       WHERE user_id = $1
         AND date >= (NOW() - INTERVAL '60 days')::date
         AND minutes_read > 0`,
      [userId],
    );
    return rows[0] ?? null;
  }

  private async queryProgressRows(userId: string): Promise<ProgressRow[]> {
    return this.ds.query(
      `SELECT rp.phrase_index, jsonb_array_length(sm.phrases) AS total_phrases
       FROM reading_progress rp
       JOIN sync_maps sm ON sm.book_id = rp.book_id
       WHERE rp.user_id = $1`,
      [userId],
    );
  }

  private async queryTopGenres(userId: string): Promise<string[]> {
    const rows: GenreRow[] = await this.ds.query(
      `SELECT b.category, count(f.id) AS fragment_count
       FROM fragments f
       JOIN books b ON b.id = f.book_id
       WHERE f.user_id = $1
       GROUP BY b.category ORDER BY fragment_count::int DESC LIMIT 3`,
      [userId],
    );
    return rows.map((r) => r.category);
  }

  private async queryClubDiscussions(userId: string): Promise<number> {
    const rows: { cnt: string }[] = await this.ds.query(
      `SELECT count(*) AS cnt FROM club_discussions WHERE user_id = $1`,
      [userId],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  private async queryFragmentStats(
    userId: string,
  ): Promise<{ total: number; avgPerBook: number }> {
    const rows: { total: string; avg_per_book: string }[] = await this.ds.query(
      `SELECT
         count(*)                                                    AS total,
         coalesce(avg(per_book.cnt), 0)                             AS avg_per_book
       FROM fragments f
       LEFT JOIN (
         SELECT book_id, count(*) AS cnt
         FROM fragments
         WHERE user_id = $1
         GROUP BY book_id
       ) per_book ON per_book.book_id = f.book_id
       WHERE f.user_id = $1`,
      [userId],
    );
    return {
      total:      Number(rows[0]?.total ?? 0),
      avgPerBook: Number(rows[0]?.avg_per_book ?? 0),
    };
  }
}
