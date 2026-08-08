import { ForbiddenException } from '@nestjs/common';
import { AdminTokensController } from '../../../src/subscriptions/admin-tokens.controller';

// Minimal collaborators — P1 only exercises the authorization gate.
const mockSubscriptionsService = {
  issueTokens: jest.fn().mockResolvedValue(undefined),
  getActiveTokenCount: jest.fn().mockResolvedValue(3),
};
const mockUsersService = {
  findById: jest.fn().mockResolvedValue({ id: 'target', email: 't@example.com' }),
};
const mockQuotaRepo = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  increment: jest.fn(),
};

// req.user carries the FULL User entity (jwt.strategy loads it), so both
// `isAdmin` and `userType` are present. These fixtures mirror books.controller.spec.
const adminUser = { id: 'admin-1', isAdmin: true, userType: null };          // real admin
const personalUser = { id: 'user-1', isAdmin: false, userType: 'personal' }; // non-admin

describe('AdminTokensController — authorization (P1)', () => {
  let controller: AdminTokensController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminTokensController(
      mockSubscriptionsService as any,
      mockUsersService as any,
      mockQuotaRepo as any,
    );
  });

  it('authorizes an admin (isAdmin === true) and performs the action', async () => {
    const res = await controller.issuePromotional(
      { user: adminUser },
      { userId: 'target', count: 2 },
    );
    expect(res).toEqual({ issued: 2, userId: 'target', type: 'promotional' });
    expect(mockSubscriptionsService.issueTokens).toHaveBeenCalledWith(
      'target', 2, 'promotional', expect.any(Object),
    );
  });

  it('rejects a non-admin with ForbiddenException (403)', async () => {
    await expect(
      controller.issuePromotional({ user: personalUser }, { userId: 'target', count: 1 }),
    ).rejects.toThrow(ForbiddenException);
    expect(mockSubscriptionsService.issueTokens).not.toHaveBeenCalled();
  });

  it('keys on isAdmin, NOT userType', async () => {
    // userType === 'admin' but isAdmin false → still denied (proves userType is not the gate).
    const fakeAdminByType = { id: 'x', isAdmin: false, userType: 'admin' };
    await expect(
      controller.getUserTokenBalance({ user: fakeAdminByType }, 'target'),
    ).rejects.toThrow(ForbiddenException);

    // isAdmin true with a non-'admin' userType → authorized (proves isAdmin is the gate).
    const realAdmin = { id: 'a', isAdmin: true, userType: 'personal' };
    await expect(
      controller.getUserTokenBalance({ user: realAdmin }, 'target'),
    ).resolves.toEqual({ userId: 'target', tokenBalance: 3 });
  });

  it('rejects a request with no user (defensive)', async () => {
    await expect(
      controller.listQuotas({ user: undefined } as any),
    ).rejects.toThrow(ForbiddenException);
  });
});
