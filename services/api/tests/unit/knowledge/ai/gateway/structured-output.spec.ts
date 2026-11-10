import { check, parseStructured } from '../../../../../src/knowledge/ai/gateway/structured-output';
import { JsonSchema } from '../../../../../src/knowledge/ai/gateway/gateway.types';

const SCHEMA: JsonSchema = {
  type: 'object', required: ['title', 'points'], additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 20 },
    points: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'object', required: ['n'], properties: { n: { type: 'integer', minimum: 1, maximum: 9 } } } },
    tone: { enum: ['neutral', 'warm'] },
    score: { type: 'number' },
    flag: { type: 'boolean' },
    nothing: { type: 'null' },
  },
};

describe('structured output (JSON-Schema subset, fail closed)', () => {
  it('a valid object passes and is returned', () => {
    const v = { title: 'Invented', points: [{ n: 2 }], tone: 'warm', score: 1.5, flag: true, nothing: null };
    expect(parseStructured(JSON.stringify(v), SCHEMA)).toEqual({ ok: true, value: v });
    expect(parseStructured('7', { type: 'number' })).toEqual({ ok: true, value: 7 }); // integer satisfies number
  });

  it.each([
    ['not JSON', '{"title": ', 'not JSON'],
    ['wrong root type', '[]', 'expected object'],
    ['missing required', '{"points":[{"n":1}]}', 'title: required'],
    ['extra property', '{"title":"a","points":[{"n":1}],"x":1}', 'x: not allowed'],
    ['string too short', '{"title":"","points":[{"n":1}]}', 'too short'],
    ['string too long', `{"title":"${'x'.repeat(21)}","points":[{"n":1}]}`, 'too long'],
    ['too few items', '{"title":"a","points":[]}', 'too few items'],
    ['too many items', '{"title":"a","points":[{"n":1},{"n":1},{"n":1},{"n":1}]}', 'too many items'],
    ['nested type', '{"title":"a","points":[{"n":1.5}]}', 'expected integer'],
    ['below minimum', '{"title":"a","points":[{"n":0}]}', 'below minimum'],
    ['above maximum', '{"title":"a","points":[{"n":10}]}', 'above maximum'],
    ['not in enum', '{"title":"a","points":[{"n":1}],"tone":"loud"}', 'not in enum'],
  ])('%s is rejected', (_l, text, reason) => {
    const r = parseStructured(text, SCHEMA);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toContain(reason);
  });

  it('unsupported schema keywords and excessive depth fail closed', () => {
    expect(parseStructured('"a"', { pattern: '.*' } as any)).toEqual({ ok: false, reason: '$: unsupported schema keyword' });
    let deep: JsonSchema = { type: 'array' };
    let value: unknown = [];
    for (let i = 0; i < 40; i++) { deep = { type: 'array', items: deep }; value = [value]; }
    expect(check(value, deep, '$', 0)).toMatch(/too deep/);
  });

  it('non-finite numbers are never accepted', () => {
    expect(check(Infinity, { type: 'number' }, '$', 0)).toBe('$: expected number');
    expect(check(undefined, { type: 'null' }, '$', 0)).toBe('$: expected null');
  });
});
