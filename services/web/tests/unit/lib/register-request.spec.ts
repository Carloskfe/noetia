// NEM-025 B2-A2a — registration request body (web).
import { registerRequestBody } from '@/lib/register-request';

const fields = { name: 'Ana', email: 'ana@example.com', password: 'password123' };

describe('registerRequestBody', () => {
  it.each(['es', 'en'] as const)('sends the active interface language %s', (lang) => {
    expect(registerRequestBody(fields, lang)).toEqual({ ...fields, uiLanguage: lang });
  });

  it('never sends fr-CA from registration, even with the web French gate on', () => {
    const saved = process.env.NEXT_PUBLIC_FR_CA_ENABLED;
    process.env.NEXT_PUBLIC_FR_CA_ENABLED = 'true';
    try {
      expect(registerRequestBody(fields, 'fr-CA')).toEqual(fields);
    } finally {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_FR_CA_ENABLED;
      else process.env.NEXT_PUBLIC_FR_CA_ENABLED = saved;
    }
  });

  it('drops an unexpected value (fail closed → API default Spanish)', () => {
    expect(registerRequestBody(fields, 'pt' as never)).toEqual(fields);
  });

  it('does not mutate or add any other field', () => {
    const input = { ...fields };
    const out = registerRequestBody(input, 'en');
    expect(input).toEqual(fields);
    expect(Object.keys(out).sort()).toEqual(['email', 'name', 'password', 'uiLanguage']);
  });
});
