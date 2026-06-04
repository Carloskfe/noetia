import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPersonas1748300000059 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_personas (
        user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        dominant_themes      JSONB        NOT NULL DEFAULT '[]',
        engagement_archetype VARCHAR(20),
        reading_cadence      VARCHAR(20),
        completion_rate      FLOAT,
        social_amplification FLOAT        NOT NULL DEFAULT 0,
        preferred_platforms  JSONB        NOT NULL DEFAULT '[]',
        top_genres           JSONB        NOT NULL DEFAULT '[]',
        avg_session_minutes  FLOAT,
        computed_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_user_personas_archetype ON user_personas(engagement_archetype)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_user_personas_cadence ON user_personas(reading_cadence)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_user_personas_computed_at ON user_personas(computed_at)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_personas`);
  }
}
