/**
 * Deterministic contract-v1 fixtures. Invented values, marked `isTestFixture`; never seeded,
 * never presented as real prices. Shared by NEM-021 tests and, later, NEM-022's simulator.
 *
 * Configuration fixtures are exported ONLY through the validation boundary (F-6), so they are
 * validated, frozen, and accepted by the monetary functions. The raw JSON is exported separately
 * for tests that must exercise the validators themselves.
 */
import { assertCapabilityDescriptor, CapabilityDescriptor, ValidatedCapabilityDescriptor } from '../capability';
import { assertPricingSchema, PricingSchema, ValidatedPricingSchema } from '../pricing';
import { assertUnitWeightSchema, UnitWeightSchema, ValidatedUnitWeightSchema } from '../unit-weights';
import { NormalizedUsage } from '../usage';
import descriptors from './descriptors-fixture.json';
import pricingA from './pricing-fixture-a.json';
import pricingB from './pricing-fixture-b.json';
import unitWeights from './unit-weights-fixture.json';
import usage from './usage-fixtures.json';

export const RAW_FIXTURE_DESCRIPTORS = descriptors as unknown as CapabilityDescriptor[];
export const RAW_FIXTURE_PRICING_A = pricingA as unknown as PricingSchema;
export const RAW_FIXTURE_PRICING_B = pricingB as unknown as PricingSchema;
export const RAW_FIXTURE_UNIT_WEIGHTS = unitWeights as unknown as UnitWeightSchema;

export const FIXTURE_DESCRIPTORS: ValidatedCapabilityDescriptor[] = RAW_FIXTURE_DESCRIPTORS.map((d) => assertCapabilityDescriptor(d));
export const FIXTURE_PRICING_A: ValidatedPricingSchema = assertPricingSchema(RAW_FIXTURE_PRICING_A);
export const FIXTURE_PRICING_B: ValidatedPricingSchema = assertPricingSchema(RAW_FIXTURE_PRICING_B);
export const FIXTURE_UNIT_WEIGHTS: ValidatedUnitWeightSchema = assertUnitWeightSchema(RAW_FIXTURE_UNIT_WEIGHTS);
export const FIXTURE_USAGE = usage as unknown as NormalizedUsage[];
