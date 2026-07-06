import {
  needsMigration,
  parseArchiveIdentifier,
  archiveIdFromLibrivoxHtml,
  sortByChapterNumber,
  pickChapterMp3s,
  minioAudioKey,
  resolveAudioSource,
} from '../../../src/ingestion/audio-source-resolver';

describe('needsMigration', () => {
  it('flags a null/empty key', () => {
    expect(needsMigration(null)).toBe(true);
    expect(needsMigration(undefined)).toBe(true);
    expect(needsMigration('')).toBe(true);
  });

  it('flags an external http(s) URL', () => {
    expect(needsMigration('https://archive.org/download/foo/bar.m4b')).toBe(true);
    expect(needsMigration('http://librivox.org/x/')).toBe(true);
  });

  it('treats a MinIO object key as already migrated', () => {
    expect(needsMigration('books/romeo-y-julieta-audio.mp3')).toBe(false);
  });
});

describe('parseArchiveIdentifier', () => {
  it('parses a download URL', () => {
    expect(parseArchiveIdentifier('https://archive.org/download/niebla_1701_librivox/x.m4b'))
      .toBe('niebla_1701_librivox');
  });

  it('parses a details URL', () => {
    expect(parseArchiveIdentifier('https://archive.org/details/cuentosdelaselva_1603_librivox'))
      .toBe('cuentosdelaselva_1603_librivox');
  });

  it('returns null for a non-archive URL', () => {
    expect(parseArchiveIdentifier('https://librivox.org/dona-perfecta/')).toBeNull();
  });
});

describe('archiveIdFromLibrivoxHtml', () => {
  it('finds the identifier in a LibriVox page body', () => {
    const html = '<a href="https://archive.org/details/dona_perfecta_1234_librivox">details</a>';
    expect(archiveIdFromLibrivoxHtml(html)).toBe('dona_perfecta_1234_librivox');
  });

  it('returns null when no archive.org link is present', () => {
    expect(archiveIdFromLibrivoxHtml('<html>no link here</html>')).toBeNull();
  });
});

describe('sortByChapterNumber', () => {
  it('orders by the first numeric run, not lexically', () => {
    expect(sortByChapterNumber(['ch10_64kb.mp3', 'ch2_64kb.mp3', 'ch1_64kb.mp3']))
      .toEqual(['ch1_64kb.mp3', 'ch2_64kb.mp3', 'ch10_64kb.mp3']);
  });
});

describe('pickChapterMp3s', () => {
  it('prefers 64kb files and orders them', () => {
    const html = `
      <a href="book_02_64kb.mp3">2</a>
      <a href="book_01_64kb.mp3">1</a>
      <a href="book_01_128kb.mp3">1hq</a>
      <a href="book.zip">zip</a>`;
    expect(pickChapterMp3s(html)).toEqual(['book_01_64kb.mp3', 'book_02_64kb.mp3']);
  });

  it('falls back to 128kb when no 64kb exist', () => {
    const html = '<a href="book_01_128kb.mp3">1</a><a href="book_02_128kb.mp3">2</a>';
    expect(pickChapterMp3s(html)).toEqual(['book_01_128kb.mp3', 'book_02_128kb.mp3']);
  });

  it('falls back to plain mp3s (excluding derivatives) when neither exists', () => {
    const html = '<a href="ch1.mp3">1</a><a href="ch2.mp3">2</a>';
    expect(pickChapterMp3s(html)).toEqual(['ch1.mp3', 'ch2.mp3']);
  });

  it('returns empty when there are no mp3s', () => {
    expect(pickChapterMp3s('<a href="book.zip">zip</a>')).toEqual([]);
  });
});

describe('minioAudioKey', () => {
  it('slugifies title (accent-stripped) into a books/*.mp3 key', () => {
    expect(minioAudioKey('Romeo y Julieta')).toBe('books/romeo-y-julieta-audio.mp3');
    expect(minioAudioKey('La Odisea')).toBe('books/la-odisea-audio.mp3');
    expect(minioAudioKey('Éxodo')).toBe('books/exodo-audio.mp3');
  });
});

describe('resolveAudioSource', () => {
  it('resolves directly from an archive.org stream key', () => {
    expect(resolveAudioSource({
      audioStreamKey: 'https://archive.org/download/niebla_1701_librivox/x.m4b',
      audioFileKey: 'https://librivox.org/niebla/',
    })).toEqual({ kind: 'archive', identifier: 'niebla_1701_librivox' });
  });

  it('falls back to the LibriVox page when there is no archive.org key', () => {
    expect(resolveAudioSource({
      audioStreamKey: null,
      audioFileKey: 'https://librivox.org/dona-perfecta-by-benito-perez-galdos/',
    })).toEqual({ kind: 'librivox', pageUrl: 'https://librivox.org/dona-perfecta-by-benito-perez-galdos/' });
  });

  it('returns null when there is no resolvable external source', () => {
    expect(resolveAudioSource({ audioStreamKey: null, audioFileKey: null })).toBeNull();
    expect(resolveAudioSource({ audioStreamKey: 'books/x-audio.mp3', audioFileKey: null })).toBeNull();
  });
});
