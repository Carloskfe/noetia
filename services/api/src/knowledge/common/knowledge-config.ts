/**
 * Operational configuration for the intelligence control plane. None of these
 * are product or budget values: budget values live in ai_budget_policies rows,
 * which exist only as marked test fixtures in NEM-019.
 */
export interface KnowledgeConfig {
  /** statement_timeout applied to every knowledge/* transaction (ms). */
  statementTimeoutMs: number;
  /** Gateway-side provider timeout (ms). */
  providerTimeoutMs: number;
  /**
   * Overall bound on unresolved reserved units across all users. Unset means no
   * bound has been approved, so admission fails closed (ADR-005).
   */
  overallUnresolvedUnitsBound?: number;
  /** TTL of rebuildable admission-cache keys (seconds). */
  admissionCacheTtlSeconds: number;
}

export const KNOWLEDGE_CONFIG = Symbol('KNOWLEDGE_CONFIG');

export function knowledgeConfigFromEnv(env: NodeJS.ProcessEnv): KnowledgeConfig {
  const int = (v: string | undefined, d: number) => {
    const n = v === undefined ? NaN : Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  const bound = env.INTELLIGENCE_OVERALL_UNRESOLVED_UNITS_BOUND;
  const parsedBound = bound === undefined ? undefined : Number.parseInt(bound, 10);
  return {
    statementTimeoutMs: int(env.INTELLIGENCE_STATEMENT_TIMEOUT_MS, 5000),
    providerTimeoutMs: int(env.INTELLIGENCE_PROVIDER_TIMEOUT_MS, 30000),
    overallUnresolvedUnitsBound:
      parsedBound !== undefined && Number.isFinite(parsedBound) && parsedBound >= 0 ? parsedBound : undefined,
    admissionCacheTtlSeconds: int(env.INTELLIGENCE_ADMISSION_CACHE_TTL_SECONDS, 60),
  };
}
