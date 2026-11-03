import { BadRequestException } from '@nestjs/common';
import {
  BG_IMAGE_MAX_CHARS,
  allowedBackgroundHosts,
  resolveBackgroundImage,
} from '../../../src/sharing/share-background';

const env = { WEB_URL: 'https://noetia.app' } as NodeJS.ProcessEnv;
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('resolveBackgroundImage', () => {
  it('passes through undefined (no background image)', () => {
    expect(resolveBackgroundImage(undefined, env)).toBeUndefined();
  });

  it.each(['data:image/png;base64,AAAA', 'data:image/jpeg;base64,AAAA', 'data:image/jpg;base64,AA==', 'data:image/webp;base64,AA'])(
    'accepts inline raster image %s',
    (uri) => expect(resolveBackgroundImage(uri, env)).toBe(uri),
  );

  it.each([
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:text/html;base64,PGgxPg==',
    'data:image/png,notbase64<script>',
  ])('rejects non-raster or malformed data URI %s', (uri) => {
    expect(() => resolveBackgroundImage(uri, env)).toThrow(BadRequestException);
  });

  it('rejects an oversized data URI', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(BG_IMAGE_MAX_CHARS);
    expect(() => resolveBackgroundImage(big, env)).toThrow(BadRequestException);
  });

  it('accepts the 18 preset images on an allowed host, in canonical form', () => {
    expect(resolveBackgroundImage('https://noetia.app/backgrounds/imagen-1.jpg', env)).toBe('https://noetia.app/backgrounds/imagen-1.jpg');
    expect(resolveBackgroundImage('https://staging.noetia.app/backgrounds/imagen-18.jpg', env)).toBe('https://staging.noetia.app/backgrounds/imagen-18.jpg');
  });

  it.each([
    'http://api:4000/health',
    'http://169.254.169.254/latest/meta-data/',
    'file:///etc/passwd',
    'gopher://noetia.app/backgrounds/imagen-1.jpg',
    'https://evil.example/backgrounds/imagen-1.jpg',
    'https://noetia.app/backgrounds/imagen-19.jpg',
    'https://noetia.app/backgrounds/imagen-0.jpg',
    'https://noetia.app/backgrounds/../images/x.png',
    'https://noetia.app/backgrounds/imagen-1.jpg?redirect=http://api',
    'https://user:pass@noetia.app/backgrounds/imagen-1.jpg',
    'https://noetia.app.evil.example/backgrounds/imagen-1.jpg',
    '/backgrounds/imagen-1.jpg',
    'not a url',
  ])('rejects unsafe or non-preset source %s', (u) => {
    expect(() => resolveBackgroundImage(u, env)).toThrow(BadRequestException);
  });

  it('error body carries the unsupported_background_image code', () => {
    try {
      resolveBackgroundImage('http://api:4000/', env);
      fail('expected throw');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'unsupported_background_image' });
    }
  });
});

describe('allowedBackgroundHosts', () => {
  it('includes production, staging and the WEB_URL host', () => {
    const hosts = allowedBackgroundHosts({ WEB_URL: 'http://localhost:3000' } as NodeJS.ProcessEnv);
    expect([...hosts].sort()).toEqual(['localhost', 'noetia.app', 'staging.noetia.app']);
  });

  it('adds SHARE_BG_ALLOWED_HOSTS entries (e.g. a LAN IP for mobile dev) and ignores a bad WEB_URL', () => {
    const hosts = allowedBackgroundHosts({ WEB_URL: '::bad::', SHARE_BG_ALLOWED_HOSTS: ' 192.168.1.20 , Example.Test ' } as NodeJS.ProcessEnv);
    expect(hosts.has('192.168.1.20')).toBe(true);
    expect(hosts.has('example.test')).toBe(true);
  });

  it('uses process.env by default', () => {
    expect(allowedBackgroundHosts().has('noetia.app')).toBe(true);
    expect(resolveBackgroundImage(PNG)).toBe(PNG);
  });
});
