import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventsTable1748300000057 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE events (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        book_id     UUID REFERENCES books(id) ON DELETE SET NULL,
        event_type  VARCHAR(50)  NOT NULL,
        payload     JSONB        NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_events_user_id    ON events(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_events_book_id    ON events(book_id)`);
    await queryRunner.query(`CREATE INDEX idx_events_event_type ON events(event_type)`);
    await queryRunner.query(`CREATE INDEX idx_events_created_at ON events(created_at)`);
    await queryRunner.query(`CREATE INDEX idx_events_user_type  ON events(user_id, event_type)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS events`);
  }
}
