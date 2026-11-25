import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Expo push-token shapes returned by `Notifications.getExpoPushTokenAsync()` (the only source the mobile
 * app uses — `usePushNotifications.ts`): `ExponentPushToken[…]` (current) and `ExpoPushToken[…]` (newer SDKs).
 * The bracketed identifier may contain any character except `]` and whitespace. Validates SHAPE, not ownership.
 */
export const EXPO_PUSH_TOKEN_PATTERN = /^Expo(?:nent)?PushToken\[[^\]\s]+\]$/;

/** Matches the `push_tokens.token` column (varchar 255). */
export const PUSH_TOKEN_MAX_LENGTH = 255;

/** Platforms accepted at registration; `unknown` remains the default when the field is omitted. */
export const PUSH_PLATFORMS = ['ios', 'android', 'web', 'unknown'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/** Body of `POST /push/register` (SP-1-I1). */
export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(PUSH_TOKEN_MAX_LENGTH)
  @Matches(EXPO_PUSH_TOKEN_PATTERN, { message: 'token must be an Expo push token' })
  token!: string;

  @IsOptional()
  @IsIn(PUSH_PLATFORMS)
  platform?: PushPlatform;
}
