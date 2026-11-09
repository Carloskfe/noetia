/**
 * Deterministic contract-v1 fixtures. Invented values, marked `isTestFixture`; never seeded,
 * never presented as real prices. Shared by NEM-021 tests and, later, NEM-022's simulator.
 */
import { CapabilityDescriptor } from '../capability';
import { PricingSchema } from '../pricing';
import { UnitWeightSchema } from '../unit-weights';
import { NormalizedUsage } from '../usage';
import descriptors from './descriptors-fixture.json';
import pricingA from './pricing-fixture-a.json';
import pricingB from './pricing-fixture-b.json';
import unitWeights from './unit-weights-fixture.json';
import usage from './usage-fixtures.json';

export const FIXTURE_DESCRIPTORS = descriptors as unknown as CapabilityDescriptor[];
export const FIXTURE_PRICING_A = pricingA as unknown as PricingSchema;
export const FIXTURE_PRICING_B = pricingB as unknown as PricingSchema;
export const FIXTURE_UNIT_WEIGHTS = unitWeights as unknown as UnitWeightSchema;
export const FIXTURE_USAGE = usage as unknown as NormalizedUsage[];
