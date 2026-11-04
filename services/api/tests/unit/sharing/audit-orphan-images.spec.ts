import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { listAllObjects, parseMinAgeHours } from '../../../src/sharing/audit-orphan-images';

describe('parseMinAgeHours', () => {
  it('defaults to 24', () => expect(parseMinAgeHours([])).toBe(24));
  it('reads the option', () => expect(parseMinAgeHours(['--min-age-hours=48'])).toBe(48));
  it('accepts 0, which local verification uses because new objects can\'t be aged', () => expect(parseMinAgeHours(['--min-age-hours=0'])).toBe(0));
  it.each(['-1', 'x', ''])('refuses %s', (v) => {
    expect(() => parseMinAgeHours([`--min-age-hours=${v}`])).toThrow('0 or more');
  });
});

describe('listAllObjects', () => {
  const d = new Date('2026-10-01T00:00:00Z');

  it('follows pagination and sends only ListObjectsV2', async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({ Contents: [{ Key: 'a.png', LastModified: d }], IsTruncated: true, NextContinuationToken: 't' })
      .mockResolvedValueOnce({ Contents: [{ Key: 'b.png', LastModified: d }], IsTruncated: false });
    const out = await listAllObjects({ send } as never);
    expect(out.map((o) => o.key)).toEqual(['a.png', 'b.png']);
    expect(send).toHaveBeenCalledTimes(2);
    for (const [cmd] of send.mock.calls) expect(cmd).toBeInstanceOf(ListObjectsV2Command);
    expect(send.mock.calls[1][0].input.ContinuationToken).toBe('t');
  });

  it('handles an empty bucket', async () => {
    const send = jest.fn().mockResolvedValue({ IsTruncated: false });
    await expect(listAllObjects({ send } as never)).resolves.toEqual([]);
  });

  it('propagates a storage failure rather than reporting a partial listing', async () => {
    const send = jest.fn().mockResolvedValueOnce({ Contents: [], IsTruncated: true, NextContinuationToken: 't' }).mockRejectedValueOnce(new Error('down'));
    await expect(listAllObjects({ send } as never)).rejects.toThrow('down');
  });
});
