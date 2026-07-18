import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingStat } from './reading-stat.entity';
import { User } from '../users/user.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(ReadingStat)
    private readonly statsRepo: Repository<ReadingStat>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async heartbeat(userId: string, phraseDelta: number): Promise<void> {
    const today = this.todayStr();
    await this.statsRepo.query(
      `INSERT INTO reading_stats ("userId", "date", "minutesRead", "phrasesRead")
       VALUES ($1, $2, 1, $3)
       ON CONFLICT ("userId", "date")
       DO UPDATE SET
         "minutesRead" = reading_stats."minutesRead" + 1,
         "phrasesRead" = reading_stats."phrasesRead" + EXCLUDED."phrasesRead"`,
      [userId, today, Math.max(0, phraseDelta)],
    );
  }

  async getMyStats(userId: string) {
    const user = await this.usersRepo.findOneBy({ id: userId });

    // Last 7 days
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const weekStats: Array<{ date: string; minutesRead: string; phrasesRead: string }> =
      await this.statsRepo.query(
        `SELECT date, "minutesRead", "phrasesRead"
         FROM reading_stats
         WHERE "userId" = $1 AND date >= $2
         ORDER BY date ASC`,
        [userId, days[0]],
      );

    const byDate = new Map(weekStats.map((r) => [r.date, r]));
    const thisWeek = days.map((date) => ({
      date,
      minutes: Number(byDate.get(date)?.minutesRead ?? 0),
      phrases: Number(byDate.get(date)?.phrasesRead ?? 0),
    }));

    // All-time totals
    const [totals]: Array<{ totalMinutes: string; totalPhrases: string }> =
      await this.statsRepo.query(
        `SELECT COALESCE(SUM("minutesRead"), 0) AS "totalMinutes",
                COALESCE(SUM("phrasesRead"), 0) AS "totalPhrases"
         FROM reading_stats WHERE "userId" = $1`,
        [userId],
      );

    // Books active this week (distinct books with progress updated in last 7 days)
    const [{ booksThisWeek }]: Array<{ booksThisWeek: string }> =
      await this.statsRepo.query(
        `SELECT COUNT(DISTINCT "bookId") AS "booksThisWeek"
         FROM reading_progress
         WHERE "userId" = $1 AND "updatedAt" >= NOW() - INTERVAL '7 days'`,
        [userId],
      );

    // Streak
    const allDates: Array<{ date: string }> = await this.statsRepo.query(
      `SELECT date FROM reading_stats
       WHERE "userId" = $1 AND "minutesRead" > 0
       ORDER BY date DESC`,
      [userId],
    );

    return {
      thisWeek,
      thisWeekMinutes: thisWeek.reduce((s, d) => s + d.minutes, 0),
      thisWeekPhrases: thisWeek.reduce((s, d) => s + d.phrases, 0),
      booksThisWeek: Number(booksThisWeek),
      streak: this.computeStreak(allDates.map((r) => r.date)),
      allTimeMinutes: Number(totals.totalMinutes),
      allTimePhrases: Number(totals.totalPhrases),
      goals: {
        weeklyMinutes: user?.goalWeeklyMinutes ?? null,
        weeklyBooks: user?.goalWeeklyBooks ?? null,
      },
    };
  }

  /**
   * Weekly and monthly reading history for the trailing 12 buckets each.
   *
   * Buckets are produced by a Postgres `generate_series`, so every week/month is
   * present and zero-filled even with no reading — the chart stays continuous —
   * and the bucket boundaries line up exactly with `date_trunc` (no JS/SQL
   * week-start drift). `start` is the bucket's first day (Monday for weeks, the
   * 1st for months) as YYYY-MM-DD.
   */
  async getStatsHistory(userId: string) {
    const [weekly, monthly] = await Promise.all([
      this.bucketSeries(userId, 'week', 12),
      this.bucketSeries(userId, 'month', 12),
    ]);
    return { weekly, monthly };
  }

  private async bucketSeries(userId: string, unit: 'week' | 'month', count: number) {
    const rows: Array<{ start: string; minutes: string; phrases: string; activeDays: string }> =
      await this.statsRepo.query(
        `SELECT to_char(gs, 'YYYY-MM-DD') AS start,
                COALESCE(SUM(rs."minutesRead"), 0) AS minutes,
                COALESCE(SUM(rs."phrasesRead"), 0) AS phrases,
                COUNT(rs.id) FILTER (WHERE rs."minutesRead" > 0) AS "activeDays"
         FROM generate_series(
                date_trunc($2, CURRENT_DATE) - (($3 || ' ' || $2)::interval),
                date_trunc($2, CURRENT_DATE),
                ('1 ' || $2)::interval
              ) AS gs
         LEFT JOIN reading_stats rs
           ON rs."userId" = $1
          AND date_trunc($2, rs.date) = gs
         GROUP BY gs
         ORDER BY gs`,
        [userId, unit, count - 1],
      );

    return rows.map((r) => ({
      start: r.start,
      minutes: Number(r.minutes),
      phrases: Number(r.phrases),
      activeDays: Number(r.activeDays),
    }));
  }

  private computeStreak(dates: string[]): number {
    if (!dates.length) return 0;
    const todayStr = this.todayStr();
    const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T12:00:00Z');
      const curr = new Date(dates[i] + 'T12:00:00Z');
      if (Math.round((prev.getTime() - curr.getTime()) / 86_400_000) === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  private todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }
}
