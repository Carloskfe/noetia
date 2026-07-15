import { effectiveDuration, formatTimecode, Phrase } from '../../../lib/reader-utils';

function phrase(startTime: number, endTime: number): Phrase {
  return { index: 0, text: 'x', startTime, endTime, type: 'text' };
}

// ── effectiveDuration (full-book length) ──────────────────────────────────────

describe('effectiveDuration', () => {
  it('uses the sync map end when audio.duration under-reports (concatenated MP3)', () => {
    // Browser reports ~one chapter (1200s) but the book is 13h per the sync map.
    const phrases = [phrase(0, 100), phrase(100, 47219)];
    expect(effectiveDuration(1200, phrases)).toBe(47219);
  });

  it('falls back to audio.duration when it is the larger value', () => {
    expect(effectiveDuration(5000, [phrase(0, 100)])).toBe(5000);
  });

  it('handles no sync map', () => {
    expect(effectiveDuration(3600, [])).toBe(3600);
  });

  it('treats a missing/NaN audio duration as 0', () => {
    expect(effectiveDuration(NaN, [phrase(0, 900)])).toBe(900);
  });
});

// ── formatTimecode (HH:MM:SS) ─────────────────────────────────────────────────

describe('formatTimecode', () => {
  it('shows HH:MM:SS for multi-hour audiobooks', () => {
    expect(formatTimecode(47219, true)).toBe('13:06:59'); // 13h 06m 59s
  });

  it('zero-pads hours, minutes and seconds in HH:MM:SS mode', () => {
    expect(formatTimecode(5, true)).toBe('00:00:05');
    expect(formatTimecode(3661, true)).toBe('01:01:01');
  });

  it('shows M:SS when withHours is false', () => {
    expect(formatTimecode(125, false)).toBe('2:05');
    expect(formatTimecode(9, false)).toBe('0:09');
  });

  it('floors fractional seconds', () => {
    expect(formatTimecode(90.9, false)).toBe('1:30');
  });

  it('clamps NaN / Infinity / negative to zero', () => {
    expect(formatTimecode(NaN, true)).toBe('00:00:00');
    expect(formatTimecode(Infinity, false)).toBe('0:00');
    expect(formatTimecode(-5, true)).toBe('00:00:00');
  });
});
