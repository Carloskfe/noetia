import { Module } from '@nestjs/common';
import { KNOWLEDGE_CONFIG, knowledgeConfigFromEnv } from './common/knowledge-config';
import { KnowledgeDbService } from './common/knowledge-db.service';
import { KnowledgeMetricsService } from './common/knowledge-metrics.service';
import { AiGatewayService } from './ai/gateway/ai-gateway.service';
import { CapabilityRouterService } from './ai/gateway/capability-router.service';
import { PROVIDER_ADAPTERS } from './ai/gateway/gateway.types';
import { SIMULATOR_DESCRIPTORS } from './ai/simulator/simulator-fixtures';
import { SimulatorV2Adapter } from './ai/simulator/simulator-v2';
import { CapabilityGuard } from './entitlement/capability.guard';
import { EntitlementService } from './entitlement/entitlement.service';
import { QUALIFYING_PLAN_PORT, UnboundQualifyingPlanPort } from './entitlement/qualifying-plan.port';
import { ADMISSION_CACHE, createAdmissionRedis, RedisAdmissionCache } from './metering/admission-cache';
import { BudgetLedgerService } from './metering/budget-ledger.service';
import { CostConfigService } from './metering/cost-config.service';
import { CostLedgerService } from './metering/cost-ledger.service';
import { CostReconciliationJobService } from './metering/cost-reconciliation-job.service';
import { RateCardService } from './metering/rate-card.service';
import { ReconciliationJobService } from './metering/reconciliation-job.service';
import {
  OWNERSHIP_PORT,
  RIGHTS_VERIFICATION_AUTHORITY_PORT,
  TEXT_IDENTITY_PORT,
  UnboundOwnershipPort,
  UnboundRightsVerificationAuthority,
  UnboundTextIdentityPort,
} from './rights/rights.ports';
import { RightsService } from './rights/rights.service';
import { ContextBuilderService } from './sessions/context-builder.service';
import { CONTEXT_SOURCE_PORT, EmptyContextSource } from './sessions/context-source.port';
import { SessionsController } from './sessions/sessions.controller';
import { SessionsService } from './sessions/sessions.service';
import { TurnService } from './sessions/turn.service';
import { TurnRecordStore } from './sessions/turn-record.store';
import { AnchorResolver } from './retrieval/anchor-resolver';
import { IndexingPermission } from './retrieval/indexing-permission';
import { LexicalRetrievalService } from './retrieval/lexical-retrieval.service';
import { QueryContextSource } from './retrieval/query-context-source.service';
import { RetrievalMetricsService } from './retrieval/retrieval-metrics.service';
import { DEFAULT_RETRIEVAL_CONFIG } from './retrieval/retrieval.types';
import { StorageBookText } from './retrieval/storage-book-text';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import { RightsVerificationAuthorityPort, TextIdentityPort } from './rights/rights.ports';

/**
 * NEM-019 dark intelligence control plane. Registered ONLY when
 * KNOWLEDGE_MODULE_ENABLED === 'true' (see knowledge.registration.ts).
 * Every port is bound to an adapter that answers `unknown`/nothing, so with
 * no production adapters every request denies. Simulated provider only.
 */
@Module({
  imports: [StorageModule],
  controllers: [SessionsController],
  providers: [
    { provide: KNOWLEDGE_CONFIG, useFactory: () => knowledgeConfigFromEnv(process.env) },
    KnowledgeDbService,
    KnowledgeMetricsService,
    EntitlementService,
    CapabilityGuard,
    RightsService,
    RateCardService,
    BudgetLedgerService,
    ReconciliationJobService,
    // NEM-021 cost-aware ledger (dark): no controller; consumed by the NEM-022 Gateway v2.
    CostConfigService,
    CostLedgerService,
    CostReconciliationJobService,
    SessionsService,
    ContextBuilderService,
    TurnService,
    // NEM-024 Checkpoint A (D-3 A6): E5 retrieval behind the turn, on the SAME unbound rights/text-identity ports
    // (default deny in the real module). The offline indexer is not registered.
    TurnRecordStore,
    RetrievalMetricsService,
    { provide: StorageBookText, useFactory: (s: StorageService) => new StorageBookText(s), inject: [StorageService] },
    {
      provide: IndexingPermission,
      useFactory: (db: KnowledgeDbService, ti: TextIdentityPort, a: RightsVerificationAuthorityPort) => new IndexingPermission(db, ti, a),
      inject: [KnowledgeDbService, TEXT_IDENTITY_PORT, RIGHTS_VERIFICATION_AUTHORITY_PORT],
    },
    {
      provide: LexicalRetrievalService,
      useFactory: (db: KnowledgeDbService, t: StorageBookText, m: RetrievalMetricsService) => new LexicalRetrievalService(db, t, m, DEFAULT_RETRIEVAL_CONFIG),
      inject: [KnowledgeDbService, StorageBookText, RetrievalMetricsService],
    },
    {
      provide: QueryContextSource,
      useFactory: (p: IndexingPermission, r: LexicalRetrievalService, m: RetrievalMetricsService) => new QueryContextSource(p, r, m, DEFAULT_RETRIEVAL_CONFIG),
      inject: [IndexingPermission, LexicalRetrievalService, RetrievalMetricsService],
    },
    { provide: AnchorResolver, useFactory: (db: KnowledgeDbService, ti: TextIdentityPort) => new AnchorResolver(db, ti), inject: [KnowledgeDbService, TEXT_IDENTITY_PORT] },
    // NEM-022 Gateway v2 (dark). Simulated adapters only; the router refuses anything else at registration.
    { provide: PROVIDER_ADAPTERS, useFactory: () => SIMULATOR_DESCRIPTORS.map((d) => new SimulatorV2Adapter(d)) },
    CapabilityRouterService,
    AiGatewayService,
    { provide: QUALIFYING_PLAN_PORT, useClass: UnboundQualifyingPlanPort },
    { provide: OWNERSHIP_PORT, useClass: UnboundOwnershipPort },
    { provide: TEXT_IDENTITY_PORT, useClass: UnboundTextIdentityPort },
    { provide: RIGHTS_VERIFICATION_AUTHORITY_PORT, useClass: UnboundRightsVerificationAuthority },
    { provide: CONTEXT_SOURCE_PORT, useClass: EmptyContextSource },
    {
      provide: ADMISSION_CACHE,
      useFactory: () => new RedisAdmissionCache(createAdmissionRedis(process.env.REDIS_URL ?? 'redis://cache:6379')),
    },
  ],
})
export class KnowledgeModule {}
