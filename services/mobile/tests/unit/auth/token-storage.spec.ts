import {
  saveToken, getToken, clearToken,
  saveRefreshToken, getRefreshToken,
  saveUserType, getUserType, isLoggedIn,
} from '../../../src/auth/token-storage';

describe('token-storage', () => {
  beforeEach(async () => { await clearToken(); });

  describe('saveToken / getToken', () => {
    it('saves and retrieves the token', async () => {
      await saveToken('tok-123');
      expect(await getToken()).toBe('tok-123');
    });

    it('returns null when no token has been saved', async () => {
      expect(await getToken()).toBeNull();
    });
  });

  describe('clearToken', () => {
    it('removes the token', async () => {
      await saveToken('tok-abc');
      await clearToken();
      expect(await getToken()).toBeNull();
    });

    it('also removes the user type', async () => {
      await saveUserType('personal');
      await clearToken();
      expect(await getUserType()).toBeNull();
    });

    it('also removes the refresh token', async () => {
      await saveRefreshToken('refresh-xyz');
      await clearToken();
      expect(await getRefreshToken()).toBeNull();
    });
  });

  describe('saveRefreshToken / getRefreshToken', () => {
    it('saves and retrieves the refresh token', async () => {
      await saveRefreshToken('refresh-abc');
      expect(await getRefreshToken()).toBe('refresh-abc');
    });

    it('returns null when no refresh token is saved', async () => {
      expect(await getRefreshToken()).toBeNull();
    });
  });

  describe('saveUserType / getUserType', () => {
    it('saves and retrieves the user type', async () => {
      await saveUserType('author');
      expect(await getUserType()).toBe('author');
    });

    it('returns null when no user type is saved', async () => {
      expect(await getUserType()).toBeNull();
    });
  });

  describe('isLoggedIn', () => {
    it('returns true when a token is stored', async () => {
      await saveToken('valid-token');
      expect(await isLoggedIn()).toBe(true);
    });

    it('returns false when no token is stored', async () => {
      expect(await isLoggedIn()).toBe(false);
    });
  });
});
