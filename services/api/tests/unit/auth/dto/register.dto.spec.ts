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

  it.each(['es', 'en', 'fr-CA'])('canonical %p passes the DTO (fr-CA is gated in AuthService)', async (v) => {
    expect(await errorsFor({ ...base, uiLanguage: v })).toEqual([]);
  });

  it.each(['pt', 'EN', 'fr', 'es-MX', '', 42, ['es'], { v: 'es' }])('non-canonical %p is rejected', async (v) => {
    expect(await errorsFor({ ...base, uiLanguage: v })).toEqual(['uiLanguage']);
  });

  it('existing rules are unchanged', async () => {
    expect(await errorsFor({ ...base, password: 'short' })).toEqual(['password']);
    expect(await errorsFor({ ...base, email: 'nope' })).toEqual(['email']);
  });
});
