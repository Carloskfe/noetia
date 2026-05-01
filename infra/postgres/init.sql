-- Noetia — PostgreSQL initialization
-- Extensions only. Application tables are managed by TypeORM migrations.
-- Tables: users, books, sync_maps, reading_progress, fragments,
--         plans, subscriptions (see services/api/src/migrations/)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
