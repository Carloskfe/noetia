# 16 — Observability

Reuse the existing **Prometheus + Grafana + Sentry** stack (NEM-001). Noetia+ adds AI-ops metrics; the reader's observability is untouched.

## Metrics (Prometheus, via the existing `/metrics` middleware pattern)
- **Traffic/latency:** `plus_requests_total{feature,provider,model,status}`, `plus_request_duration_seconds{feature}`, retrieval latency, embedding latency.
- **Reliability:** `plus_failures_total{feature,errorCode}`, provider error rate, queue failure rate.
- **Cost (the critical ones):** `plus_ai_cost_micros_total{feature,model}` (from config-priced `ai_usage_events`), **`plus_cost_per_active_subscriber`**, **`plus_cost_per_feature`**, tokens/context sizes, embeddings generated.
- **Efficiency:** cache-hit rate, rerank rate, model-tier distribution (share of Cheap/Mid/High — a key cost lever).
- **Backlogs:** embedding backlog, queue depth per `plus-*` queue.
- **Fair-use:** `plus_limit_reached_total{type}`.

## The cost-guardrail ratio (mission §46)
Expose enough telemetry to compute, in production:
```
AI_COGS / Noetia+_revenue
```
- `AI_COGS` = Σ `ai_usage_events.estCostMicros` (+ infra share) over the period, from real config prices.
- `Noetia+_revenue` = active Noetia+ subscriptions × plan price (from `subscriptions`/`plans`).
- A Grafana panel + alert bands: **Excellent ≤15% · Healthy 15–30% · Caution 30–45% · Unsustainable >45%** ([07](07-cost-and-usage-model.md)). Alert fires (existing Grafana alerting, `or vector(0)` pattern) on Caution/Unsustainable.

## Budget guard (operational safety)
A **global monthly AI budget** threshold; when projected/actual spend crosses it, the orchestrator degrades (High→Mid routing, then soft-limit, then kill switch) and alerts — spend can't run away silently. Per-user anomaly detection flags abuse.

## Logging & tracing
- Sentry captures Noetia+ exceptions with a **`plus`** environment/tag, separate from reader errors. No prompt/answer *content* in logs by default (privacy — [15](15-privacy.md)); log IDs, sizes, models, costs.
- Optional lightweight trace: `conversationId`/`usageEventId` correlation across retrieval → model → citation.

## Dashboards
A dedicated **Noetia+ Grafana dashboard**: cost/subscriber, COGS ratio, tier mix, latency, failure rate, queue backlogs, cache hit rate, fair-use hits. Kept distinct from the reader/infra dashboards.

## Evaluation telemetry
Offline eval results ([EXECUTIVE §47]) (citation accuracy, hallucination rate, grounding, extraction-refusal) tracked over model/prompt versions before rollout — a quality gate, not just runtime metrics.
