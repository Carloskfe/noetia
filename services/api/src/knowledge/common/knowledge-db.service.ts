import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from './knowledge-config';

/**
 * Database access for knowledge/*. Every transaction gets a statement timeout
 * (NEM-019 §9). The dedicated pool is deferred to the first retrieval mission.
 */
@Injectable()
export class KnowledgeDbService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(KNOWLEDGE_CONFIG) private readonly config: KnowledgeConfig,
  ) {}

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.dataSource.query(sql, params);
  }

  async transaction<T>(fn: (m: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SET LOCAL statement_timeout = ${Math.floor(this.config.statementTimeoutMs)}`);
      return fn(m);
    });
  }
}
