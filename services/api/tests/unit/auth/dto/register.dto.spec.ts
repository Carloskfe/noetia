/** NEM-025 B2-A2a — RegisterDto.uiLanguage validation (ValidationPipe: whitelist + transform). */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../../../../src/auth/dto/register.dto';

const base = { name: 'Ana', email: 'ana@example.com', password: 'password123' };

async function errorsFor(body: Record<string, unknown>) {
  const errs = await validate(plainToInstance(RegisterDto, body), { whitelist: true });
  return errs.map((e) => e.property);
}

describe('RegisterDto', () => {
  it('old clients: no language is valid (field optional)', async () => {
    expect(await errorsFor(base)).toEqual([]);
  });

  it.each(['es', 'en'])('%p passes the DTO', async (v) => {
    expect(await errorsFor({ ...base, uiLanguage: v })).toEqual([]);
  });

  it('fr-CA is rejected by the DTO even with FR_CA_ENABLED=true (F-B2A2a-1)', async () => {
    const saved = process.env.FR_CA_ENABLED;
    process.env.FR_CA_ENABLED = 'true';
    try {
      expect(await errorsFor({ ...base, uiLanguage: 'fr-CA' })).toEqual(['uiLanguage']);
    } finally {
      if (saved === undefined) delete process.env.FR_CA_ENABLED;
      else process.env.FR_CA_ENABLED = saved;
    }
  });

  it.each(['pt', 'EN', 'fr', 'es-MX', '', 42, ['es'], { v: 'es' }])('non-canonical %p is rejected', async (v) => {
    expect(await errorsFor({ ...base, uiLanguage: v })).toEqual(['uiLanguage']);
  });

  it('existing rules are unchanged', async () => {
    expect(await errorsFor({ ...base, password: 'short' })).toEqual(['password']);
    expect(await errorsFor({ ...base, email: 'nope' })).toEqual(['email']);
  });
});
