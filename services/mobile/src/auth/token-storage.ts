import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  TOKEN: 'noetia_access_token',
  REFRESH: 'noetia_refresh_token',
  USER_TYPE: 'noetia_user_type',
} as const;

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.TOKEN, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.TOKEN);
}

// Native apps have no cookie jar, so the (rotating) refresh token is stored here
// and sent to /auth/refresh to silently re-issue an access token — keeping the
// user signed in across launches without re-login.
export async function saveRefreshToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.REFRESH, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.REFRESH);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.TOKEN);
  await AsyncStorage.removeItem(KEYS.REFRESH);
  await AsyncStorage.removeItem(KEYS.USER_TYPE);
}

export async function saveUserType(type: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER_TYPE, type);
}

export async function getUserType(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.USER_TYPE);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}
