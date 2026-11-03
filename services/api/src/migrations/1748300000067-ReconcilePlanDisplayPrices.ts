import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NOF-003 Phase 2C — corrects the displayed amount on the four legacy plan rows.
 *
 * Migrations 039 and 041 matched on `name = 'Individual'` / `IN ('Reader','Duo')`,
 * but 010 seeded `'Individual Monthly'`, `'Dual Reader Monthly'`, etc., so 039's
 * price updates matched zero rows and production kept displaying the pre-PO-006
 * amounts. This migration targets the rows by their exact existing name + interval.
 *
 * Only `amountCents` changes. Plan IDs, names, intervals, `stripePriceId`,
 * `tokensPerCycle`, `maxProfiles`, `createdAt` and `token_packages` are untouched
 * (Stripe charges by price ID, not by `amountCents`).
 *
 * Safeguards: every target is validated before any row is written — exactly one
 * row per (name, interval), and its amount must be either the expected old value
 * or the approved new value. Anything else aborts the migration with no writes.
 * Rows already at the approved amount are left alone, so re-running is a no-op.
 */
export const PLAN_PRICE_CORRECTIONS: ReadonlyArray<{
  name: string;
  interval: 'month' | 'year';
  oldCents: number;
  newCents: number;
}> = [
  { name: 'Individual Monthly',  interval: 'month', oldCents: 999,   newCents: 899 },
  { name: 'Individual Annual',   interval: 'year',  oldCents: 8900,  newCents: 8399 },
  { name: 'Dual Reader Monthly', interval: 'month', oldCents: 1499,  newCents: 1399 },
  { name: 'Dual Reader Annual',  interval: 'year',  oldCents: 13500, newCents: 12999 },
];

export class ReconcilePlanDisplayPrices1748300000067 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, 'up');
  }

  /**
   * Restores the previous (outdated) amounts under the same safeguards. Only
   * useful to undo this migration exactly; it reintroduces the $9.99 / $14.99 display.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, 'down');
  }

  private async apply(queryRunner: QueryRunner, direction: 'up' | 'down'): Promise<void> {
    const pending: Array<{ id: string; from: number; to: number }> = [];

    for (const target of PLAN_PRICE_CORRECTIONS) {
      const label = `"${target.name}" (${target.interval})`;
      const rows: Array<{ id: string; amountCents: number }> = await queryRunner.query(
        `SELECT "id", "amountCents" FROM "plans" WHERE "name" = $1 AND "interval" = $2 FOR UPDATE`,
        [target.name, target.interval],
      );

      if (rows.length !== 1) {
        throw new Error(
          `ReconcilePlanDisplayPrices: expected exactly 1 plan row for ${label}, found ${rows.length}. No changes made.`,
        );
      }

      const current = Number(rows[0].amountCents);
      if (current !== target.oldCents && current !== target.newCents) {
        throw new Error(
          `ReconcilePlanDisplayPrices: unexpected amountCents ${current} for ${label} ` +
            `(expected ${target.oldCents} or ${target.newCents}). No changes made.`,
        );
      }

      const [from, to] = direction === 'up'
        ? [target.oldCents, target.newCents]
        : [target.newCents, target.oldCents];
      if (current === from) pending.push({ id: rows[0].id, from, to });
    }

    for (const { id, from, to } of pending) {
      await queryRunner.query(
        `UPDATE "plans" SET "amountCents" = $1 WHERE "id" = $2 AND "amountCents" = $3`,
        [to, id, from],
      );
    }
  }
}
