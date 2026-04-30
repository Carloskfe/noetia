import { Test, TestingModule } from '@nestjs/testing';
import { AuthorsController } from '../../../src/authors/authors.controller';
import { AuthorsService } from '../../../src/authors/authors.service';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';

const mockAuthorsService = {
  findMyBooks: jest.fn(),
};

const mockUser = { id: 'user-1', userType: 'author', isAdmin: false };

describe('AuthorsController', () => {
  let controller: AuthorsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthorsController],
      providers: [
        { provide: AuthorsService, useValue: mockAuthorsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthorsController>(AuthorsController);
    jest.clearAllMocks();
  });

  describe('getMyBooks', () => {
    it('returns the books for the authenticated user', async () => {
      const books = [{ id: 'b-1', title: 'Mi Libro' }];
      mockAuthorsService.findMyBooks.mockResolvedValue(books);

      const result = await controller.getMyBooks({ user: mockUser });

      expect(mockAuthorsService.findMyBooks).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(books);
    });

    it('returns empty array when user has no books', async () => {
      mockAuthorsService.findMyBooks.mockResolvedValue([]);
      const result = await controller.getMyBooks({ user: mockUser });
      expect(result).toEqual([]);
    });
  });
});
