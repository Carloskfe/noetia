import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ShareFragmentDto, QUOTE_MAX_CHARS, CITATION_MAX_CHARS } from '../../../../src/sharing/dto/share-fragment.dto';

const check = async (body: Record<string, unknown>) =>
  (await validate(plainToInstance(ShareFragmentDto, body))).map((e) => e.property);

describe('ShareFragmentDto', () => {
  it('accepts the payloads the web and mobile clients send today', async () => {
    expect(await check({
      platform: 'instagram', format: 'story', font: 'playfair', bgType: 'gradient',
      bgColors: ['#0D1B2A', '#1E3A5F'], textColor: '#FFFFFF', text: 'Una cita', citation: 'Cap. 2',
      textBold: true, textItalic: false, gradientDir: 'to-bottom', bgImage: 'data:image/png;base64,AA',
      bgFlip: true, bgFit: 'blur', textAlign: 'left', textScale: 1.15,
    })).toEqual([]);
    expect(await check({ platform: 'linkedin', format: 'post', font: 'playfair', bgType: 'image',
      bgImage: 'https://noetia.app/backgrounds/imagen-3.jpg' })).toEqual([]);
    expect(await check({ platform: 'facebook', textColor: '#fff' })).toEqual([]);
  });

  it('requires a known platform', async () => {
    expect(await check({})).toContain('platform');
    expect(await check({ platform: 'myspace' })).toContain('platform');
  });

  it('caps the quote and citation length', async () => {
    expect(await check({ platform: 'linkedin', text: 'a'.repeat(QUOTE_MAX_CHARS + 1) })).toContain('text');
    expect(await check({ platform: 'linkedin', citation: 'a'.repeat(CITATION_MAX_CHARS + 1) })).toContain('citation');
  });

  it('rejects malformed colours, too many colours and non-boolean flags', async () => {
    expect(await check({ platform: 'linkedin', bgColors: ['red'] })).toContain('bgColors');
    expect(await check({ platform: 'linkedin', bgColors: Array(5).fill('#000000') })).toContain('bgColors');
    expect(await check({ platform: 'linkedin', textColor: 'javascript:alert(1)' })).toContain('textColor');
    expect(await check({ platform: 'linkedin', textBold: 'yes' })).toContain('textBold');
  });

  it('rejects out-of-range or unknown layout values', async () => {
    expect(await check({ platform: 'linkedin', textScale: 10 })).toContain('textScale');
    expect(await check({ platform: 'linkedin', textAlign: 'justify' })).toContain('textAlign');
    expect(await check({ platform: 'linkedin', bgFit: 'stretch' })).toContain('bgFit');
    expect(await check({ platform: 'linkedin', bgType: 'video' })).toContain('bgType');
    expect(await check({ platform: 'linkedin', font: 'x'.repeat(41) })).toContain('font');
  });
});
