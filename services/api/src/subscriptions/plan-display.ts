/**
 * Customer-facing plan names for internal `plans.name` values.
 *
 * Production rows keep legacy internal names (`Individual Monthly`,
 * `Dual Reader Annual`, …); anything shown to a customer (emails, push) must go
 * through `customerPlanName` instead of using the raw name. Mirrors
 * services/web/lib/plan-display.ts.
 */
export type PlanKey = 'Individual' | 'Duo' | 'Family';
type Lang = 'es' | 'en';

const PATTERNS: ReadonlyArray<[RegExp, PlanKey]> = [
  [/^individual\b/, 'Individual'],
  [/^(duo|dúo|dual reader|dual|reader)(\s|$)/, 'Duo'],
  [/^(family|familia)\b/, 'Family'],
];

const LABELS: Record<Lang, Record<PlanKey, string>> = {
  en: { Individual: 'Individual', Duo: 'Duo', Family: 'Family' },
  es: { Individual: 'Individual', Duo: 'Dúo', Family: 'Familia' },
};

export function planKey(name: string | null | undefined): PlanKey | null {
  const normalized = (name ?? '').trim().toLowerCase();
  for (const [pattern, key] of PATTERNS) {
    if (pattern.test(normalized)) return key;
  }
  return null;
}

/** Approved label for the plan in `lang`; unknown names are returned unchanged. */
export function customerPlanName(name: string, lang: string = 'es'): string {
  const key = planKey(name);
  if (!key) return name;
  return LABELS[lang === 'en' ? 'en' : 'es'][key];
}
