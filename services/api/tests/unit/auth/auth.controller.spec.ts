import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../../../src/auth/auth.controller';

// Focused on the web-cookie vs mobile-body token handling added for
// "keep users signed in" (native apps have no cookie jar).

function makeRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as any;
}

const user = { id: 'u1', email: 'a@b.com', name: 'A', userType: 'personal', emailConfirmed: true };

function makeController(overrides: {
  validate?: boolean;
} = {}) {
  const authService = {
    issueTokens: jest.fn().mockResolvedValue({ accessToken: 'acc', refreshTokenId: 'rt1', user }),
    register: jest.fn().mockResolvedValue({ accessToken: 'acc', refreshTokenId: 'rt1', user }),
  } as any;
  const tokenService = {
    validateRefreshToken: jest.fn().mockResolvedValue(overrides.validate ?? true),
    deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
    generateAccessToken: jest.fn().mockReturnValue('acc2'),
    generateRefreshToken: jest.fn().mockResolvedValue('rt2'),
  } as any;
  const usersService = { findById: jest.fn().mockResolvedValue(user) } as any;
  return { controller: new AuthController(authService, tokenService, usersService), authService, tokenService, usersService };
}

describe('AuthController — login token delivery', () => {
  it('mobile (X-Client-Type header) gets the refresh token in the body, no cookie', async () => {
    const { controller } = makeController();
    const res = makeRes();
    const req = { user, headers: { 'x-client-type': 'mobile' } };
    const out = await controller.login(req as any, res);
    expect(out).toMatchObject({ accessToken: 'acc', refreshToken: 'u1:rt1' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('web (no header) gets an httpOnly cookie, no refresh token in the body', async () => {
    const { controller } = makeController();
    const res = makeRes();
    const req = { user, headers: {} };
    const out = await controller.login(req as any, res);
    expect(out).not.toHaveProperty('refreshToken');
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'u1:rt1', expect.objectContaining({ httpOnly: true }));
  });
});

describe('AuthController — refresh', () => {
  it('mobile body token: rotates and returns the new refresh token in the body (no cookie)', async () => {
    const { controller, tokenService } = makeController();
    const res = makeRes();
    const req = { body: { refreshToken: 'u1:rt1' }, cookies: {}, headers: { 'x-client-type': 'mobile' } };
    const out = await controller.refresh(req as any, res);
    expect(tokenService.deleteRefreshToken).toHaveBeenCalledWith('u1', 'rt1'); // old rotated out
    expect(out).toMatchObject({ accessToken: 'acc2', refreshToken: 'u1:rt2' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('web cookie token: rotates and sets a new cookie, no body refresh token', async () => {
    const { controller } = makeController();
    const res = makeRes();
    const req = { body: {}, cookies: { refresh_token: 'u1:rt1' }, headers: {} };
    const out = await controller.refresh(req as any, res);
    expect(out).not.toHaveProperty('refreshToken');
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'u1:rt2', expect.objectContaining({ httpOnly: true }));
  });

  it('throws Unauthorized when no token is present', async () => {
    const { controller } = makeController();
    const req = { body: {}, cookies: {}, headers: {} };
    await expect(controller.refresh(req as any, makeRes())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('invalid body token: throws, does NOT clear a cookie', async () => {
    const { controller } = makeController({ validate: false });
    const res = makeRes();
    const req = { body: { refreshToken: 'u1:bad' }, cookies: {}, headers: {} };
    await expect(controller.refresh(req as any, res)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it('invalid cookie token: throws and clears the cookie', async () => {
    const { controller } = makeController({ validate: false });
    const res = makeRes();
    const req = { body: {}, cookies: { refresh_token: 'u1:bad' }, headers: {} };
    await expect(controller.refresh(req as any, res)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
  });
});

describe('AuthController — logout', () => {
  it('deletes the refresh token from the body (mobile) and clears the cookie', async () => {
    const { controller, tokenService } = makeController();
    const res = makeRes();
    const req = { body: { refreshToken: 'u1:rt1' }, cookies: {} };
    await controller.logout(req as any, res);
    expect(tokenService.deleteRefreshToken).toHaveBeenCalledWith('u1', 'rt1');
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
  });
});
