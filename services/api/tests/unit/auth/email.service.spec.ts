import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../../../src/email/email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockCreateTransport = nodemailer.createTransport as jest.Mock;

beforeEach(() => {
  mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  mockSendMail.mockClear();
});

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();
    service = module.get(EmailService);
  });

  describe('sendEmailConfirmation', () => {
    it('sends email with confirmation link', async () => {
      await service.sendEmailConfirmation('user@example.com', 'Carlos', 'abc123token');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('user@example.com');
      expect(call.subject).toContain('Confirma');
      expect(call.html).toContain('abc123token');
      expect(call.html).toContain('Carlos');
    });

    it('escapes HTML in user name', async () => {
      await service.sendEmailConfirmation('user@example.com', '<script>alert(1)</script>', 'tok');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).not.toContain('<script>');
      expect(call.html).toContain('&lt;script&gt;');
    });

    it('does not throw if sendMail fails (swallows and logs)', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));
      await expect(
        service.sendEmailConfirmation('user@example.com', 'Carlos', 'tok'),
      ).resolves.not.toThrow();
    });
  });

  describe('sendPasswordReset', () => {
    it('sends email with reset link', async () => {
      await service.sendPasswordReset('user@example.com', 'Carlos', 'resettoken123');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('user@example.com');
      expect(call.subject).toContain('contraseña');
      expect(call.html).toContain('resettoken123');
    });

    it('does not throw if sendMail fails', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('Connection refused'));
      await expect(
        service.sendPasswordReset('user@example.com', 'Carlos', 'tok'),
      ).resolves.not.toThrow();
    });
  });
  describe('sendPlanInvite', () => {
    it.each([
      ['Dual Reader Monthly', 'es', 'Ana te invita a Noetia Dúo', 'su plan <strong>Dúo</strong>'],
      ['Dual Reader Annual', 'en', 'Ana invites you to Noetia Duo', 'their <strong>Duo</strong> plan'],
      ['Individual Monthly', 'es', 'Ana te invita a Noetia Individual', 'su plan <strong>Individual</strong>'],
      ['Family', 'es', 'Ana te invita a Noetia Familia', 'su plan <strong>Familia</strong>'],
      ['Family', 'en', 'Ana invites you to Noetia Family', 'their <strong>Family</strong> plan'],
    ])('uses the customer-facing name for %p (%s)', async (internal, lang, subject, body) => {
      await service.sendPlanInvite('friend@example.com', 'Ana', internal, 'tok123', lang as 'es' | 'en');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toBe(subject);
      expect(call.html).toContain(body);
      expect(call.subject).not.toMatch(/Dual Reader|Monthly|Annual/);
      expect(call.html).not.toMatch(/Dual Reader|Monthly|Annual/);
    });

    it('defaults to Spanish when no language is given (current caller behaviour)', async () => {
      await service.sendPlanInvite('friend@example.com', 'Ana', 'Dual Reader Monthly', 'tok123');

      expect(mockSendMail.mock.calls[0][0].subject).toBe('Ana te invita a Noetia Dúo');
    });

    it('keeps the join link and token, and still escapes the inviter name', async () => {
      await service.sendPlanInvite('friend@example.com', '<b>Ana</b>', 'Individual Annual', 'tok123');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('friend@example.com');
      expect(call.html).toContain('/join?token=tok123');
      expect(call.subject).toBe('&lt;b&gt;Ana&lt;/b&gt; te invita a Noetia Individual');
    });

    it('passes unknown plan names through unchanged', async () => {
      await service.sendPlanInvite('friend@example.com', 'Ana', 'Noetia', 'tok123', 'en');

      expect(mockSendMail.mock.calls[0][0].subject).toBe('Ana invites you to Noetia Noetia');
    });
  });
});
