// G1-I1 trusted-proxy configuration — unit tests (T-I1-08 invalid/stale configuration, T-I1-09 CIDR families).
import express from 'express';
import { applyTrustedProxy, parseTrustedProxyCidrs, TRUSTED_PROXY_MAX_ENTRIES } from '../../../src/common/trusted-proxy';

const disabled = (raw: string | undefined | null) => {
  const r = parseTrustedProxyCidrs(raw);
  expect(r.enabled).toBe(false);
  return r as { enabled: false; reason: string };
};

describe('parseTrustedProxyCidrs — accepted values', () => {
  it.each([
    ['10.211.75.8/29', ['10.211.75.8/29']],
    ['  10.211.75.8/29  ', ['10.211.75.8/29']],
    ['10.211.75.8/29,10.211.76.0/24', ['10.211.75.8/29', '10.211.76.0/24']],
    ['127.0.0.2/32', ['127.0.0.2/32']],
    ['fd00:abcd::/112', ['fd00:abcd::/112']],
    ['fd00:abcd::1/128', ['fd00:abcd::1/128']],
  ])('%p → enabled', (raw, cidrs) => {
    expect(parseTrustedProxyCidrs(raw)).toEqual({ enabled: true, cidrs });
  });

  it(`accepts exactly ${TRUSTED_PROXY_MAX_ENTRIES} entries`, () => {
    expect(parseTrustedProxyCidrs('10.0.0.0/24,10.0.1.0/24,10.0.2.0/24,10.0.3.0/24').enabled).toBe(true);
  });
});

describe('parseTrustedProxyCidrs — T-I1-08 fail-safe rejections (trust stays disabled)', () => {
  it.each([undefined, null, '', '   '])('unset/empty %p → disabled ("not set")', (raw) => {
    expect(disabled(raw).reason).toMatch(/not set/);
  });

  it.each([
    ['keyword true', 'true'],
    ['keyword false', 'false'],
    ['keyword loopback', 'loopback'],
    ['keyword uniquelocal', 'uniquelocal'],
    ['keyword linklocal', 'linklocal'],
    ['hop count', '1'],
    ['hop count 2', '2'],
    ['bare IPv4 address', '10.211.75.9'],
    ['bare IPv6 address', '::1'],
    ['netmask notation', '10.211.75.0/255.255.255.0'],
    ['hostname', 'traefik'],
    ['hostname with prefix', 'traefik/32'],
    ['invalid IPv4', '10.211.75.300/29'],
    ['invalid IPv6', 'fd00::zz/120'],
    ['prefix > 32', '10.211.75.8/33'],
    ['prefix > 128', 'fd00::/129'],
    ['negative prefix', '10.211.75.8/-1'],
    ['trailing comma', '10.211.75.8/29,'],
    ['empty middle entry', '10.211.75.8/29,,10.0.0.0/24'],
    ['mixed valid + keyword', '10.211.75.8/29,loopback'],
    ['mixed valid + invalid', '10.211.75.8/29,nope'],
    ['IPv4-in-IPv6 notation', '::ffff:10.211.75.8/120'],
  ])('%s (%p) → disabled', (_label, raw) => {
    disabled(raw);
  });

  it.each([
    ['all IPv4', '0.0.0.0/0'],
    ['RFC1918 10/8', '10.0.0.0/8'],
    ['RFC1918 172.16/12', '172.16.0.0/12'],
    ['RFC1918 192.168/16', '192.168.0.0/16'],
    ['Docker default bridge /16', '172.17.0.0/16'],
    ['/23', '10.211.74.0/23'],
    ['all IPv6', '::/0'],
    ['IPv6 ULA /7', 'fc00::/7'],
    ['IPv6 /64', 'fd00:abcd::/64'],
    ['IPv6 /111', 'fd00:abcd::/111'],
  ])('over-broad %s (%p) → disabled', (_label, raw) => {
    expect(disabled(raw).reason).toMatch(/too broad/);
  });

  it(`more than ${TRUSTED_PROXY_MAX_ENTRIES} entries → disabled`, () => {
    expect(disabled('10.0.0.0/24,10.0.1.0/24,10.0.2.0/24,10.0.3.0/24,10.0.4.0/24').reason).toMatch(/more than/);
  });
});

describe('applyTrustedProxy — applies only validated values; never throws; logs', () => {
  const logger = () => ({ log: jest.fn(), warn: jest.fn() });

  it('valid → Express `trust proxy` compiled from exactly those CIDRs; one log line', () => {
    const app = express();
    const l = logger();
    expect(applyTrustedProxy(app, '10.211.75.8/29', l)).toEqual({ enabled: true, cidrs: ['10.211.75.8/29'] });
    const trust = app.get('trust proxy fn') as (addr: string, i: number) => boolean;
    expect(trust('10.211.75.9', 0)).toBe(true);
    expect(trust('::ffff:10.211.75.9', 0)).toBe(true); // IPv4-mapped peer (dual-stack listener)
    expect(trust('10.211.75.1', 0)).toBe(false); // gateway outside the allocation range
    expect(trust('10.211.75.16', 0)).toBe(false);
    expect(trust('172.18.0.3', 0)).toBe(false); // shared `proxy` network address
    expect(trust('127.0.0.1', 0)).toBe(false);
    expect(l.log).toHaveBeenCalledTimes(1);
    expect(l.warn).not.toHaveBeenCalled();
  });

  it('unset → trust left at Express default (none), informational log, no warning', () => {
    const app = express();
    const l = logger();
    expect(applyTrustedProxy(app, undefined, l).enabled).toBe(false);
    const trust = app.get('trust proxy fn') as (addr: string, i: number) => boolean;
    expect(trust('10.211.75.9', 0)).toBe(false);
    expect(l.log).toHaveBeenCalledTimes(1);
    expect(l.warn).not.toHaveBeenCalled();
  });

  it.each(['true', 'loopback', '1', '10.0.0.0/8', 'garbage'])('invalid %p → not applied (no trust), one WARN', (raw) => {
    const app = { set: jest.fn() };
    const l = logger();
    expect(applyTrustedProxy(app, raw, l).enabled).toBe(false);
    expect(app.set).not.toHaveBeenCalled();
    expect(l.warn).toHaveBeenCalledTimes(1);
    expect(String(l.warn.mock.calls[0][0])).toMatch(/\[trusted-proxy\] disabled/);
  });

  it('if Express rejects the value, it does not throw and reports disabled with a WARN', () => {
    const app = { set: jest.fn(() => { throw new TypeError('invalid IP address'); }) };
    const l = logger();
    expect(applyTrustedProxy(app, '10.211.75.8/29', l)).toEqual({ enabled: false, reason: 'rejected by Express' });
    expect(l.warn).toHaveBeenCalledTimes(1);
  });

  it('logs never contain anything but the configured ranges', () => {
    const l = logger();
    applyTrustedProxy(express(), '10.211.75.8/29', l);
    expect(String(l.log.mock.calls[0][0])).toBe('[trusted-proxy] X-Forwarded-For honoured only from 10.211.75.8/29');
  });
});
