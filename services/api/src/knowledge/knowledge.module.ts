import { Module } from '@nestjs/common';
import { KNOWLEDGE_CONFIG, knowledgeConfigFromEnv } from './common/knowledge-config';
import { KnowledgeDbService } from './common/knowledge-db.service';
import { KnowledgeMetricsService } from './common/knowledge-metrics.service';
import { ModelGatewayService } from './ai/model-gateway.service';
import { MODEL_PROVIDERS } from './ai/model-provider';
import { ModelRouterService } from './ai/model-router.service';
import { SimulatedProviderService } from './ai/simulated-provider.service';
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

/**
 * NEM-019 dark intelligence control plane. Registered ONLY when
 * KNOWLEDGE_MODULE_ENABLED === 'true' (see knowledge.registration.ts).
 * Every port is bound to an adapter that answers `unknown`/nothing, so with
 * no production adapters every request denies. Simulated provider only.
 */
@Module({
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
    // NEM-021 cost-aware ledger (dark): no controller; consumed by the Gateway only under NEM-022.
    CostConfigService,
    CostLedgerService,
    CostReconciliationJobService,
    SessionsService,
    ContextBuilderService,
    TurnService,
    SimulatedProviderService,
    ModelRouterService,
    ModelGatewayService,
    { provide: MODEL_PROVIDERS, useFactory: (sim: SimulatedProviderService) => [sim], inject: [SimulatedProviderService] },
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
