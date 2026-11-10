/** Small, dependency-free validation helpers shared by the contract validators. */

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export class Checker {
  readonly errors: string[] = [];

  fail(path: string, message: string) {
    this.errors.push(`${path}: ${message}`);
  }

  isObject(v: unknown, path: string): v is Record<string, unknown> {
    const ok = typeof v === 'object' && v !== null && !Array.isArray(v);
    if (!ok) this.fail(path, 'must be an object');
    return ok;
  }

  onlyKeys(o: Record<string, unknown>, allowed: readonly string[], path: string) {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) this.fail(`${path}.${k}`, 'unknown field (content or undeclared fields are not allowed)');
  }

  string(v: unknown, path: string, { allowEmpty = false } = {}): v is string {
    const ok = typeof v === 'string' && (allowEmpty || v.trim() !== '');
    if (!ok) this.fail(path, 'must be a non-empty string');
    return ok;
  }

  bool(v: unknown, path: string): v is boolean {
    const ok = typeof v === 'boolean';
    if (!ok) this.fail(path, 'must be a boolean');
    return ok;
  }

  int(v: unknown, path: string, min: number, max: number): v is number {
    const ok = typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
    if (!ok) this.fail(path, `must be an integer in [${min}, ${max}]`);
    return ok;
  }

  oneOf<T extends string>(v: unknown, values: readonly T[], path: string): v is T {
    const ok = typeof v === 'string' && (values as readonly string[]).includes(v);
    if (!ok) this.fail(path, `must be one of ${values.join(', ')}`);
    return ok;
  }

  isoDate(v: unknown, path: string, { nullable = false } = {}): boolean {
    if (nullable && v === null) return true;
    const ok = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(v) && !Number.isNaN(Date.parse(v));
    if (!ok) this.fail(path, 'must be an ISO-8601 date (UTC)');
    return ok;
  }

  result<T>(value: unknown): ValidationResult<T> {
    return this.errors.length ? { ok: false, errors: this.errors } : { ok: true, value: value as T };
  }
}

/** Lifetime keys such as `5m`, `30m`, `1h`, `12h`. */
export const LIFETIME_PATTERN = /^[1-9][0-9]*(m|h)$/;
/** Keys for non-token units and modifiers. */
export const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
