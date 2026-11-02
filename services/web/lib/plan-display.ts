/**
 * Maps internal `plans.name` values to stable presentation keys.
 *
 * Production plan rows keep their legacy internal names (`Individual Monthly`,
 * `Dual Reader Annual`, …) and each billing interval is its own row, so UI copy
 * must never be looked up by the raw name. Customer-facing labels live in i18n
 * under `pricing.planNames[key]`.
 */
export type PlanKey = 'Individual' | 'Duo' | 'Family';

const PATTERNS: ReadonlyArray<[RegExp, PlanKey]> = [
  [/^individual\b/, 'Individual'],
  [/^(duo|dúo|dual reader|dual|reader)(\s|$)/, 'Duo'],
  [/^(family|familia)\b/, 'Family'],
];

export function planKey(name: string | null | undefined): PlanKey | null {
  const normalized = (name ?? '').trim().toLowerCase();
  for (const [pattern, key] of PATTERNS) {
    if (pattern.test(normalized)) return key;
  }
  return null;
}

/** Customer-facing label for a plan; unknown names fall back to the raw name. */
export function planLabel(
  name: string | null | undefined,
  labels: Record<PlanKey, string>,
): string | null {
  const key = planKey(name);
  if (key) return labels[key];
  const raw = (name ?? '').trim();
  return raw || null;
}
