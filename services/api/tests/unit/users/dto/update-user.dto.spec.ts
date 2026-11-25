import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from '../../../../src/users/dto/update-user.dto';

async function uiLanguageErrors(value: unknown) {
  const dto = plainToInstance(UpdateUserDto, { uiLanguage: value });
  const errors = await validate(dto);
  return errors.filter((e) => e.property === 'uiLanguage');
}

describe('UpdateUserDto.uiLanguage', () => {
  it.each(['es', 'en'])('accepts the existing value %p (backward compatible)', async (v) => {
    expect(await uiLanguageErrors(v)).toHaveLength(0);
  });

  it('accepts the canonical fr-CA value at the DTO level (the controller applies the readiness gate)', async () => {
    expect(await uiLanguageErrors('fr-CA')).toHaveLength(0);
  });

  it.each(['fr', 'fr-ca', 'pt', 'EN', 'xx', '', 'es-MX'])('rejects the non-canonical value %p', async (v) => {
    expect(await uiLanguageErrors(v)).toHaveLength(1);
  });

  it('rejects a non-string value', async () => {
    expect(await uiLanguageErrors(5)).toHaveLength(1);
  });

  it('is optional', async () => {
    const errors = await validate(plainToInstance(UpdateUserDto, { name: 'Ana' }));
    expect(errors).toHaveLength(0);
  });
});
