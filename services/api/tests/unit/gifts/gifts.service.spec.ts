import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailService } from '../../../src/email/email.service';
import { TokenLedger } from '../../../src/subscriptions/token-ledger.entity';
import { User } from '../../../src/users/user.entity';
import { GiftCard } from '../../../src/gifts/gift-card.entity';
import { GiftsService } from '../../../src/gifts/gifts.service';

const mockStripe = {
  checkout: { sessions: { create: jest.fn() } },
};

jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripe));

const mockGiftRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOneBy: jest.fn(),
  update: jest.fn(),
};

const mockTokenRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockUserRepo = { findOneBy: jest.fn() };

const mockEmailService = {
  sendGiftCard: jest.fn(),
  sendGiftConfirmation: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
    return fallback ?? '';
  }),
};

describe('GiftsService', () => {
  let service: GiftsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftsService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmailService, useValue: mockEmailService },
        { provide: getRepositoryToken(GiftCard), useValue: mockGiftRepo },
        { provide: getRepositoryToken(TokenLedger), useValue: mockTokenRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get(GiftsService);
  });

  describe('createGiftSession', () => {
    it('creates a Stripe checkout session for 1 token', async () => {
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/gift' });
      const result = await service.createGiftSession('buyer1', 'gift@test.com', 1, 'Feliz cumpleaños', 'birthday');
      expect(result).toEqual({ url: 'https://checkout.stripe.com/gift' });
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'payment', metadata: expect.objectContaining({ type: 'gift', tokenCount: '1' }) }),
      );
    });

    it('creates a checkout session for 3 tokens', async () => {
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/gift3' });
      const result = await service.createGiftSession(null, 'gift@test.com', 3, null, null);
      expect(result.url).toBeDefined();
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ tokenCount: '3' }) }),
      );
    });

    it('throws BadRequestException for invalid token count', async () => {
      await expect(service.createGiftSession(null, 'x@y.com', 5, null, null)).rejects.toThrow(BadRequestException);
    });
  });

  describe('fulfillGift', () => {
    it('creates gift card record and sends emails', async () => {
      mockGiftRepo.create.mockImplementation((d: any) => d);
      mockGiftRepo.save.mockResolvedValue({ id: 'gc1' });
      mockUserRepo.findOneBy.mockResolvedValue({ name: 'Carlos' });
      mockEmailService.sendGiftCard.mockResolvedValue(undefined);
      mockEmailService.sendGiftConfirmation.mockResolvedValue(undefined);

      await service.fulfillGift({
        id: 'cs_test_1',
        metadata: { type: 'gift', buyerUserId: 'u1', recipientEmail: 'r@test.com', tokenCount: '3', message: 'Congrats', occasion: 'graduation' },
        customer_details: { email: 'buyer@test.com', name: 'Carlos' },
      });

      expect(mockGiftRepo.save).toHaveBeenCalled();
      expect(mockEmailService.sendGiftCard).toHaveBeenCalledWith('r@test.com', 'Carlos', 3, 'Congrats', expect.any(String), expect.any(String));
      expect(mockEmailService.sendGiftConfirmation).toHaveBeenCalledWith('buyer@test.com', 'Carlos', 'r@test.com', 3);
    });

    it('skips when metadata is missing recipientEmail', async () => {
      await service.fulfillGift({ id: 'cs_1', metadata: { type: 'gift' }, customer_details: null });
      expect(mockGiftRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('claimGift', () => {
    it('issues tokens and marks gift as claimed', async () => {
      mockGiftRepo.findOneBy.mockResolvedValue({
        id: 'gc1', tokenCount: 3, status: 'sent', expiresAt: new Date(Date.now() + 86400000),
      });
      mockTokenRepo.create.mockImplementation((d: any) => d);
      mockTokenRepo.save.mockResolvedValue([]);
      mockGiftRepo.update.mockResolvedValue({});

      const result = await service.claimGift('valid-token', 'user1');
      expect(result).toEqual({ tokenCount: 3 });
      expect(mockTokenRepo.create).toHaveBeenCalledTimes(3);
      expect(mockGiftRepo.update).toHaveBeenCalledWith('gc1', expect.objectContaining({ status: 'claimed', claimedByUserId: 'user1' }));
    });

    it('throws NotFoundException for unknown token', async () => {
      mockGiftRepo.findOneBy.mockResolvedValue(null);
      await expect(service.claimGift('bad', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for already claimed gift', async () => {
      mockGiftRepo.findOneBy.mockResolvedValue({ status: 'claimed', expiresAt: new Date(Date.now() + 86400000) });
      await expect(service.claimGift('tok', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for expired gift', async () => {
      mockGiftRepo.findOneBy.mockResolvedValue({ status: 'sent', expiresAt: new Date(Date.now() - 1000) });
      mockGiftRepo.update.mockResolvedValue({});
      await expect(service.claimGift('tok', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getGiftPreview', () => {
    it('returns gift preview data', async () => {
      mockGiftRepo.findOneBy.mockResolvedValue({
        tokenCount: 1, message: 'Hello', occasion: 'birthday', buyerEmail: 'b@x.com', status: 'sent',
      });
      const result = await service.getGiftPreview('tok');
      expect(result.tokenCount).toBe(1);
      expect(result.occasion).toBe('🎂 Cumpleaños');
    });

    it('throws NotFoundException for unknown token', async () => {
      mockGiftRepo.findOneBy.mockResolvedValue(null);
      await expect(service.getGiftPreview('bad')).rejects.toThrow(NotFoundException);
    });
  });
});
