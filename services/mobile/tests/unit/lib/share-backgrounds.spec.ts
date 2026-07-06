import {
  BG_PRESETS,
  BG_PRESET_COUNT,
  DEFAULT_STYLE,
  SHARE_FORMAT,
  WEB_URL,
  buildSharePayload,
  Platform,
} from '../../../src/lib/share-backgrounds';

describe('BG_PRESETS', () => {
  it('exposes exactly 18 Noetia gallery backgrounds', () => {
    expect(BG_PRESET_COUNT).toBe(18);
    expect(BG_PRESETS).toHaveLength(18);
  });

  it('every preset is an absolute /backgrounds/imagen-N.jpg URL', () => {
    BG_PRESETS.forEach((url, i) => {
      expect(url).toBe(`${WEB_URL}/backgrounds/imagen-${i + 1}.jpg`);
    });
  });

  it('has no duplicate preset URLs', () => {
    expect(new Set(BG_PRESETS).size).toBe(BG_PRESETS.length);
  });
});

describe('SHARE_FORMAT', () => {
  it('maps every platform to a format string', () => {
    (['instagram', 'facebook', 'linkedin', 'pinterest'] as Platform[]).forEach((p) => {
      expect(typeof SHARE_FORMAT[p]).toBe('string');
      expect(SHARE_FORMAT[p].length).toBeGreaterThan(0);
    });
  });
});

describe('buildSharePayload — default (gradient) background', () => {
  it('sends the default gradient style and no image fields', () => {
    const body = buildSharePayload('instagram', { type: 'default' });
    expect(body).toMatchObject({
      platform: 'instagram',
      format: SHARE_FORMAT.instagram,
      font: DEFAULT_STYLE.font,
      bgType: 'gradient',
      bgColors: DEFAULT_STYLE.bgColors,
      textColor: DEFAULT_STYLE.textColor,
    });
    expect(body).not.toHaveProperty('bgImage');
    expect(body).not.toHaveProperty('bgFlip');
  });

  it('ignores flip for the default background (no-op)', () => {
    const body = buildSharePayload('facebook', { type: 'default', flip: true });
    expect(body.bgType).toBe('gradient');
    expect(body).not.toHaveProperty('bgFlip');
  });
});

describe('buildSharePayload — preset (image) background', () => {
  const presetUrl = BG_PRESETS[2];

  it('sends bgType=image and the preset URL as bgImage', () => {
    const body = buildSharePayload('linkedin', { type: 'preset', presetUrl });
    expect(body).toMatchObject({
      platform: 'linkedin',
      format: SHARE_FORMAT.linkedin,
      bgType: 'image',
      bgImage: presetUrl,
    });
    expect(body).not.toHaveProperty('bgColors');
  });

  it('sends bgFlip=true only when the mirror toggle is on', () => {
    const on = buildSharePayload('instagram', { type: 'preset', presetUrl, flip: true });
    expect(on.bgFlip).toBe(true);

    const off = buildSharePayload('instagram', { type: 'preset', presetUrl, flip: false });
    expect(off).not.toHaveProperty('bgFlip');
  });

  it('falls back to the default gradient when the preset URL is missing', () => {
    const body = buildSharePayload('pinterest', { type: 'preset', flip: true });
    expect(body.bgType).toBe('gradient');
    expect(body).not.toHaveProperty('bgImage');
    expect(body).not.toHaveProperty('bgFlip');
  });
});

describe('buildSharePayload — text style (bold / italic)', () => {
  it('omits textBold/textItalic when neither is set', () => {
    const body = buildSharePayload('instagram', { type: 'default' });
    expect(body).not.toHaveProperty('textBold');
    expect(body).not.toHaveProperty('textItalic');
  });

  it('sends textBold/textItalic only when enabled', () => {
    const body = buildSharePayload('instagram', { type: 'default' }, { bold: true, italic: false });
    expect(body.textBold).toBe(true);
    expect(body).not.toHaveProperty('textItalic');
  });

  it('carries text style through on an image background too', () => {
    const body = buildSharePayload(
      'linkedin',
      { type: 'preset', presetUrl: BG_PRESETS[0], flip: true },
      { bold: true, italic: true },
    );
    expect(body).toMatchObject({ bgType: 'image', bgFlip: true, textBold: true, textItalic: true });
  });
});
