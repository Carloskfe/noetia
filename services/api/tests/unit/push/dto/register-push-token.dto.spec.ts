/** SP-1-I1 — POST /push/register body validation through the app's global ValidationPipe settings. */
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  EXPO_PUSH_TOKEN_PATTERN,
  PUSH_PLATFORMS,
  RegisterPushTokenDto,
} from '../../../../src/push/dto/register-push-token.dto';

// Same options as main.ts
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const run = (body: unknown) => pipe.transform(body, { type: 'body', metatype: RegisterPushTokenDto });

describe('RegisterPushTokenDto (SP-1-I1)', () => {
  it.each([
    ['mobile test fixture', 'ExponentPushToken[test]'],
    ['typical Expo token', 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'],
    ['mixed charset', 'ExponentPushToken[AbC-123_xyz.9]'],
    ['newer SDK prefix', 'ExpoPushToken[AbC123]'],
    ['255 characters exactly', 'ExponentPushToken[' + 'a'.repeat(255 - 19) + ']'],
  ])('13. accepts %s', async (_l, token) => {
    expect(token.length).toBeLessThanOrEqual(255);
    await expect(run({ token })).resolves.toMatchObject({ token });
  });

  it.each(PUSH_PLATFORMS)('13. accepts platform %s', async (platform) => {
    await expect(run({ token: 'ExponentPushToken[abc]', platform })).resolves.toMatchObject({ platform });
  });

  it('13. platform omitted stays undefined (controller keeps the "unknown" default)', async () => {
    const dto = (await run({ token: 'ExponentPushToken[abc]' })) as RegisterPushTokenDto;
    expect(dto.platform).toBeUndefined();
  });

  it('13. unknown extra fields are stripped, not rejected (whitelist, as for every DTO)', async () => {
    const dto = await run({ token: 'ExponentPushToken[abc]', platform: 'ios', extra: 'x' });
    expect(dto).not.toHaveProperty('extra');
  });

  it.each([
    ['missing token', {}],
    ['empty token', { token: '' }],
    ['non-string token', { token: 12345 }],
    ['not an Expo token', { token: 'abc' }],
    ['raw APNs/FCM-style token', { token: 'f1e2d3c4b5a6' }],
    ['empty brackets', { token: 'ExponentPushToken[]' }],
    ['whitespace inside', { token: 'ExponentPushToken[a b]' }],
    ['trailing garbage', { token: 'ExponentPushToken[abc]x' }],
    ['wrong case prefix', { token: 'exponentpushtoken[abc]' }],
    ['256 characters', { token: 'ExponentPushToken[' + 'a'.repeat(256 - 19) + ']' }],
    ['unsupported platform', { token: 'ExponentPushToken[abc]', platform: 'windows' }],
    ['platform wrong case', { token: 'ExponentPushToken[abc]', platform: 'IOS' }],
    ['platform over 20 chars', { token: 'ExponentPushToken[abc]', platform: 'x'.repeat(21) }],
  ])('12. rejects %s with 400', async (_l, body) => {
    await expect(run(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pattern is anchored', () => {
    expect(EXPO_PUSH_TOKEN_PATTERN.test('xExponentPushToken[a]')).toBe(false);
  });
});
