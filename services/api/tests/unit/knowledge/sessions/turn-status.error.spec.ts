import { HttpStatus } from '@nestjs/common';
import { IntelligenceDenied } from '../../../../src/knowledge/common/intelligence-denied.error';
import { TurnStatusDenied } from '../../../../src/knowledge/sessions/turn-status.error';

describe('TurnStatusDenied (Q-4: existing codes + status payload)', () => {
  it('keeps the accepted code, status, and message, and adds a content-free status payload', () => {
    const e = new TurnStatusDenied('duplicate_turn', { turnId: 't-1', status: 'accepted' });
    expect(e).toBeInstanceOf(IntelligenceDenied);
    expect(e.reason).toBe('duplicate_turn');
    expect(e.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(e.getResponse()).toEqual({ code: 'duplicate_turn', message: 'This request was already submitted.', turnId: 't-1', status: 'accepted' });
  });
  it('carries release and recorded flags for step-4 failures', () => {
    const e = new TurnStatusDenied('set_changed', { status: 'failed', reservationRelease: 'unconfirmed', recorded: false });
    expect(e.getResponse()).toMatchObject({ code: 'set_changed', status: 'failed', reservationRelease: 'unconfirmed', recorded: false });
  });
});
