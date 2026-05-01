import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Book } from '../../../src/books/book.entity';
import { SyncMap, SyncPhrase } from '../../../src/books/sync-map.entity';
import { AlignmentService, Chapter } from '../../../src/ingestion/alignment.service';

function makePhrase(overrides: Partial<SyncPhrase> & { index: number; text: string }): SyncPhrase {
  return { startTime: 0, endTime: 0, type: 'text', ...overrides };
}

function heading(index: number, text = 'Chapter'): SyncPhrase {
  return makePhrase({ index, text, type: 'heading' });
}

function text(index: number, text = 'Some text here.'): SyncPhrase {
  return makePhrase({ index, text, type: 'text' });
}

const THREE_CHAPTERS: Chapter[] = [
  { title: 'Chapter 1', startMs: 0,      endMs: 10_000 },
  { title: 'Chapter 2', startMs: 10_000, endMs: 20_000 },
  { title: 'Chapter 3', startMs: 20_000, endMs: 30_000 },
];

async function buildService() {
  const module = await Test.createTestingModule({
    providers: [
      AlignmentService,
      { provide: getRepositoryToken(Book),    useValue: { find: jest.fn(), findOneBy: jest.fn() } },
      { provide: getRepositoryToken(SyncMap), useValue: { findOneBy: jest.fn(), save: jest.fn() } },
      { provide: ConfigService, useValue: { get: (k: string, d: string) => d } },
    ],
  }).compile();
  return module.get(AlignmentService);
}

describe('AlignmentService.assignTimestamps', () => {
  let service: AlignmentService;
  beforeEach(async () => { service = await buildService(); });

  it('assigns timestamps to all phrases when headings match chapter count', () => {
    const phrases = [
      heading(0, 'Chapter 1'),
      text(1, 'First paragraph.'),
      text(2, 'Second paragraph.'),
      heading(3, 'Chapter 2'),
      text(4, 'Third paragraph.'),
      heading(5, 'Chapter 3'),
      text(6, 'Last paragraph.'),
    ];

    const result = service.assignTimestamps(phrases, THREE_CHAPTERS);

    expect(result.every(p => p.endTime >= p.startTime)).toBe(true);
    expect(result.every(p => p.startTime >= 0)).toBe(true);
    // Chapter 1 phrases stay within chapter 1 time range
    expect(result[0].startTime).toBeGreaterThanOrEqual(0);
    expect(result[2].endTime).toBeLessThanOrEqual(10_000);
    // Chapter 2 phrases within chapter 2 range
    expect(result[3].startTime).toBeGreaterThanOrEqual(10_000);
    expect(result[4].endTime).toBeLessThanOrEqual(20_000);
  });

  it('falls back to full-book linear distribution when no headings', () => {
    const phrases = [text(0, 'A'), text(1, 'B'), text(2, 'C')];

    const result = service.assignTimestamps(phrases, THREE_CHAPTERS);

    expect(result[0].startTime).toBe(0);
    expect(result[result.length - 1].endTime).toBe(30_000);
    expect(result.every(p => p.endTime > p.startTime || p.text.length === 0)).toBe(true);
  });

  it('falls back to linear when headings greatly outnumber chapters', () => {
    const manyHeadings = Array.from({ length: 20 }, (_, i) => heading(i, `H${i}`));

    const result = service.assignTimestamps(manyHeadings, THREE_CHAPTERS);

    expect(result[0].startTime).toBe(0);
    expect(result[result.length - 1].endTime).toBe(30_000);
  });

  it('produces monotonically non-decreasing startTimes', () => {
    const phrases = [
      heading(0, 'Chapter 1'),
      text(1, 'Short.'),
      text(2, 'A longer sentence with more words to fill space.'),
      heading(3, 'Chapter 2'),
      text(4, 'Middle content.'),
      heading(5, 'Chapter 3'),
      text(6, 'End content.'),
    ];

    const result = service.assignTimestamps(phrases, THREE_CHAPTERS);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].startTime).toBeGreaterThanOrEqual(result[i - 1].startTime);
    }
  });

  it('does not mutate the original phrases array', () => {
    const phrases = [heading(0), text(1), heading(2), text(3), heading(4), text(5)];
    const original = phrases.map(p => ({ ...p }));

    service.assignTimestamps(phrases, THREE_CHAPTERS);

    phrases.forEach((p, i) => {
      expect(p.startTime).toBe(original[i].startTime);
      expect(p.endTime).toBe(original[i].endTime);
    });
  });
});

describe('AlignmentService.distributeLinear', () => {
  let service: AlignmentService;
  beforeEach(async () => { service = await buildService(); });

  it('spans full duration from startMs to endMs', () => {
    const phrases = [text(0, 'Hello world.'), text(1, 'Goodbye world.')];
    const result = service.distributeLinear(phrases, 5_000, 15_000);

    expect(result[0].startTime).toBe(5_000);
    expect(result[result.length - 1].endTime).toBe(15_000);
  });

  it('allocates time proportional to character count', () => {
    // 4 chars vs 8 chars → first gets ~1/3 of duration
    const phrases = [text(0, 'Hi!!'), text(1, 'Hello there!!')];
    const result = service.distributeLinear(phrases, 0, 12_000);

    const first = result[0].endTime - result[0].startTime;
    const second = result[1].endTime - result[1].startTime;
    expect(second).toBeGreaterThan(first);
  });

  it('handles single phrase spanning full duration', () => {
    const phrases = [text(0, 'Only phrase.')];
    const result = service.distributeLinear(phrases, 0, 60_000);

    expect(result[0].startTime).toBe(0);
    expect(result[0].endTime).toBe(60_000);
  });
});
