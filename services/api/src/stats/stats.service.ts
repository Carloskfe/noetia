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
