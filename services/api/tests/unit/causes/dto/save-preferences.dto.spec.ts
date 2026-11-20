import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SavePreferencesDto } from '../../../../src/causes/dto/save-preferences.dto';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UUID2 = '9b2c1e0a-1d3e-4c5f-8a6b-7c8d9e0f1a2b';

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(SavePreferencesDto, body);
  const errors = await validate(dto, { whitelist: true });
  return errors.map((e) => e.property);
}

describe('SavePreferencesDto (PO-053 single-cause contract)', () => {
  it('accepts one cause', async () => {
    expect(await errorsFor({ cause1Id: UUID })).toEqual([]);
  });

  it('accepts no preference (null or empty body)', async () => {
    expect(await errorsFor({ cause1Id: null })).toEqual([]);
    expect(await errorsFor({})).toEqual([]);
  });

  it('accepts the explicit single-cause shape sent by the web client', async () => {
    expect(await errorsFor({ cause1Id: UUID, cause2Id: null, randomDistribution: false })).toEqual([]);
  });

  it('rejects a second cause', async () => {
    expect(await errorsFor({ cause1Id: UUID, cause2Id: UUID2 })).toEqual(['cause2Id']);
  });

  it('rejects random distribution', async () => {
    expect(await errorsFor({ cause1Id: null, randomDistribution: true })).toEqual(['randomDistribution']);
  });

  it('rejects a non-UUID cause id', async () => {
    expect(await errorsFor({ cause1Id: 'not-a-uuid' })).toEqual(['cause1Id']);
  });
});
