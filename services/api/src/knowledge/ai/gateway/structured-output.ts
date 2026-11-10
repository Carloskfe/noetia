import { JsonSchema } from './gateway.types';

/**
 * Structured-output validation (NEM-022 §5.5) for the JSON-Schema subset in `JsonSchema`. No dependency:
 * the subset is small, deterministic, and fails closed on anything it does not understand.
 * Callers receive an object only after it validates; otherwise the attempt is `completed` + `malformed_output`.
 */
export type StructuredResult = { ok: true; value: unknown } | { ok: false; reason: string };

const MAX_DEPTH = 32;

export function parseStructured(text: string, schema: JsonSchema): StructuredResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not JSON' };
  }
  const reason = check(value, schema, '$', 0);
  return reason === null ? { ok: true, value } : { ok: false, reason };
}

function typeOf(v: unknown): JsonSchema['type'] | 'unknown' {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isFinite(v) ? (Number.isInteger(v) ? 'integer' : 'number') : 'unknown';
  if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'object') return typeof v as JsonSchema['type'];
  return 'unknown';
}

/** Returns null when `v` satisfies `s`, else the first violation (a JSON path, no content). */
export function check(v: unknown, s: JsonSchema, path: string, depth: number): string | null {
  if (depth > MAX_DEPTH) return `${path}: too deep`;
  const known = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'minLength', 'maxLength',
    'minimum', 'maximum', 'minItems', 'maxItems']);
  if (Object.keys(s).some((k) => !known.has(k))) return `${path}: unsupported schema keyword`;
  const t = typeOf(v);
  if (s.type) {
    const okType = s.type === t || (s.type === 'number' && t === 'integer');
    if (!okType) return `${path}: expected ${s.type}`;
  }
  if (s.enum && !s.enum.some((e) => e === v)) return `${path}: not in enum`;
  if (typeof v === 'string') {
    if (s.minLength !== undefined && [...v].length < s.minLength) return `${path}: too short`;
    if (s.maxLength !== undefined && [...v].length > s.maxLength) return `${path}: too long`;
  }
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) return `${path}: below minimum`;
    if (s.maximum !== undefined && v > s.maximum) return `${path}: above maximum`;
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) return `${path}: too few items`;
    if (s.maxItems !== undefined && v.length > s.maxItems) return `${path}: too many items`;
    if (s.items) {
      for (let i = 0; i < v.length; i++) {
        const r = check(v[i], s.items, `${path}[${i}]`, depth + 1);
        if (r) return r;
      }
    }
  }
  if (t === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of s.required ?? []) if (!Object.prototype.hasOwnProperty.call(o, k)) return `${path}.${k}: required`;
    for (const [k, val] of Object.entries(o)) {
      const sub = s.properties?.[k];
      if (sub) {
        const r = check(val, sub, `${path}.${k}`, depth + 1);
        if (r) return r;
      } else if (s.additionalProperties === false) return `${path}.${k}: not allowed`;
    }
  }
  return null;
}
