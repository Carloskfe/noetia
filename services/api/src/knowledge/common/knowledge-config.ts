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
  /**
   * NEM-022 Gateway v2 (all optional; operational, not product values). Unset means the conservative default
   * applied where used: 1 attempt (no retry), no backoff, no rate-limit wait, 100 ms abort grace, and a turn
   * output bound of 1,024 tokens with no billable tool calls.
   */
  maxProviderAttempts?: number;
  retryBackoffMs?: number;
  maxRetryDelayMs?: number;
  abortGraceMs?: number;
  turnMaxOutputTokens?: number;
  turnMaxToolCalls?: number;
}

export const KNOWLEDGE_CONFIG = Symbol('KNOWLEDGE_CONFIG');

function optionalInt<K extends keyof KnowledgeConfig>(key: K, v: string | undefined): Partial<KnowledgeConfig> {
  if (v === undefined || !/^\d+$/.test(v)) return {};
  const n = Number.parseInt(v, 10);
  return Number.isSafeInteger(n) ? { [key]: n } : {};
}

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
    // NEM-022: present only when explicitly configured (defaults apply where used).
    ...optionalInt('maxProviderAttempts', env.INTELLIGENCE_MAX_PROVIDER_ATTEMPTS),
    ...optionalInt('retryBackoffMs', env.INTELLIGENCE_RETRY_BACKOFF_MS),
    ...optionalInt('maxRetryDelayMs', env.INTELLIGENCE_MAX_RETRY_DELAY_MS),
    ...optionalInt('abortGraceMs', env.INTELLIGENCE_ABORT_GRACE_MS),
    ...optionalInt('turnMaxOutputTokens', env.INTELLIGENCE_TURN_MAX_OUTPUT_TOKENS),
    ...optionalInt('turnMaxToolCalls', env.INTELLIGENCE_TURN_MAX_TOOL_CALLS),
  };
}
