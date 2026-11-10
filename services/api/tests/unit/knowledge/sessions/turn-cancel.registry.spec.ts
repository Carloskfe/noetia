import { TurnCancelRegistry } from '../../../../src/knowledge/sessions/turn-cancel.registry';

describe('TurnCancelRegistry (explicit cancellation, in-process)', () => {
  it('aborts a registered owner; unknown keys report false; unregister only removes its own signal', () => {
    const r = new TurnCancelRegistry();
    const s1 = r.register('turn:a');
    expect(r.abort('turn:b')).toBe(false);
    expect(r.abort('turn:a')).toBe(true);
    expect(s1.aborted).toBe(true);
    const s2 = r.register('turn:a'); // a later owner for the same key replaces the entry
    r.unregister('turn:a', s1); // the stale owner cannot remove the new one
    expect(r.size).toBe(1);
    r.unregister('turn:a', s2);
    expect(r.size).toBe(0);
    expect(s2.aborted).toBe(false);
  });
});
