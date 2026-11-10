import {
  assertCapabilityDescriptor, CapabilityDescriptor, PricingSchema, ValidatedCapabilityDescriptor,
} from '../contract';
import { RAW_FIXTURE_DESCRIPTORS, RAW_FIXTURE_PRICING_A, RAW_FIXTURE_PRICING_B } from '../contract/fixtures';

/**
 * Simulator v2 models and their fixture pricing (NEM-022 §5.7). Derived from the frozen E1 fixtures:
 * - `sim-standard`: fixture A's structure (lifetime-specific cache writes, no long-context tier, a billable tool call);
 * - `sim-long-context`: fixture B's structure (whole-request tier above 200,000 input tokens, automatic cache
 *   writes, separate reasoning bound, a documented no-charge class for rate limits).
 * Only the provider/model keys change, and the token-counting method is flagged `estimated` because the simulator
 * counts with a documented approximation. Every rate is the E1 fixture's, so pricing goes through E1 unchanged.
 * All values are invented TEST FIXTURES, never prices.
 */
export const SIMULATOR_PROVIDER_KEY = 'simulated';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function simDescriptor(base: CapabilityDescriptor, modelKey: string, conservativeFactorBps: number): CapabilityDescriptor {
  const d = clone(base);
  d.providerKey = SIMULATOR_PROVIDER_KEY;
  d.modelKey = modelKey;
  d.simulated = true;
  d.tokenCountingMethod = { mode: 'estimated', conservativeFactorBps };
  return d;
}

function simPricing(base: PricingSchema, modelKey: string): PricingSchema {
  const p = clone(base);
  p.id = `simulator-${modelKey}-v1`;
  p.providerKey = SIMULATOR_PROVIDER_KEY;
  p.modelKey = modelKey;
  p.sourceNote = `TEST FIXTURE for simulator v2, rates copied from ${base.id}. Values are invented and are not prices.`;
  return p;
}

const [A, B] = RAW_FIXTURE_DESCRIPTORS;

/** The simulator counts exactly the tokens it later reports, so a 1.0 factor is conservative for `sim-standard`. */
export const RAW_SIMULATOR_DESCRIPTORS: readonly CapabilityDescriptor[] = Object.freeze([
  simDescriptor(A, 'sim-standard', 10_000),
  simDescriptor(B, 'sim-long-context', 11_000),
]);

export const SIMULATOR_DESCRIPTORS: readonly ValidatedCapabilityDescriptor[] = Object.freeze(
  RAW_SIMULATOR_DESCRIPTORS.map((d) => assertCapabilityDescriptor(d)),
);

/** Fixture pricing for the simulator models (to be stored through CostConfigService by tests and harnesses). */
export const RAW_SIMULATOR_PRICING: readonly PricingSchema[] = Object.freeze([
  simPricing(RAW_FIXTURE_PRICING_A, 'sim-standard'),
  simPricing(RAW_FIXTURE_PRICING_B, 'sim-long-context'),
]);
