import { Inject, Injectable } from '@nestjs/common';
import { conservativeInputTokens, isValidated } from '../contract';
import { GatewayRequest, PromptEnvelope, PROVIDER_ADAPTERS, ProviderAdapter } from './gateway.types';

export type Negotiation =
  | { ok: true; adapter: ProviderAdapter; countedInputTokens: number; reservedInputTokens: number }
  | { ok: false; error: 'capability_unavailable' | 'context_too_large' };

/**
 * Capability negotiation (NEM-022 §5.2) over a simulated-only allowlist.
 *
 * - Registration refuses any adapter that is not simulated (flag AND descriptor) or whose descriptor is not
 *   sealed by the contract validators, so no real provider can be registered before the launch-readiness gate.
 * - Selection picks the first registered adapter whose descriptor serves the path, every required capability
 *   and feature, the output mode, the cache lifetime, and the output bound; then checks the context size with the
 *   adapter's own token count (conservative estimate for `estimated` counters).
 * - None capable → `capability_unavailable`; capable but too large → `context_too_large`. Both before any reservation.
 */
@Injectable()
export class CapabilityRouterService {
  private readonly adapters: readonly ProviderAdapter[];

  constructor(@Inject(PROVIDER_ADAPTERS) adapters: ProviderAdapter[]) {
    for (const a of adapters) {
      if (a.simulated !== true || !isValidated(a.descriptor, 'capability descriptor') || a.descriptor.simulated !== true) {
        throw new Error('only simulated provider adapters may be registered');
      }
    }
    this.adapters = Object.freeze([...adapters]);
  }

  /** Whether the adapter's declared capabilities satisfy the request (no token counting). */
  satisfies(adapter: ProviderAdapter, req: GatewayRequest): boolean {
    const d = adapter.descriptor;
    if (!d.modelPaths.includes(req.pathId)) return false;
    if (!req.requiredCapabilities.every((c) => d.capabilities.includes(c))) return false;
    if (req.output.mode === 'structured' && !d.features.structuredOutput) return false;
    if (req.requiredFeatures?.streaming && !d.features.streaming) return false;
    if (req.requiredFeatures?.citations && !d.features.citations) return false;
    if (req.cacheIntent.mode !== 'none' && !d.features.cacheHints.lifetimes.includes(req.cacheIntent.lifetime)) return false;
    return Number.isSafeInteger(req.maxOutputTokens) && req.maxOutputTokens >= 1 && req.maxOutputTokens <= d.maxOutputTokens;
  }

  negotiate(req: GatewayRequest, envelope: PromptEnvelope): Negotiation {
    const capable = this.adapters.filter((a) => a.simulated === true && a.descriptor.simulated === true && this.satisfies(a, req));
    if (capable.length === 0) return { ok: false, error: 'capability_unavailable' };
    for (const adapter of capable) {
      const counted = adapter.countTokens(envelope, req.output);
      const reserved = conservativeInputTokens(adapter.descriptor, counted);
      if (reserved <= adapter.descriptor.maxContextTokens) return { ok: true, adapter, countedInputTokens: counted, reservedInputTokens: reserved };
    }
    return { ok: false, error: 'context_too_large' };
  }
}
