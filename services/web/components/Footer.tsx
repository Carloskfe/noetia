'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';

/** Public navy pages: the single global footer adopts the dark tone there (no page renders its own footer). */
const DARK_ROUTES = ['/', '/causas'];

export default function Footer() {
  const { t } = useTranslation();
  const f = t.footer;
  const pathname = usePathname();
  const dark = DARK_ROUTES.includes(pathname ?? '');

  const c = dark
    ? {
        root: 'border-t border-white/10 bg-navy mt-auto',
        brand: 'text-white',
        tagline: 'text-slate-400',
        heading: 'text-slate-300',
        link: 'text-slate-400 hover:text-white',
        rule: 'border-white/10',
        meta: 'text-slate-400',
      }
    : {
        root: 'border-t border-gray-100 bg-white mt-auto',
        brand: 'text-[#0D1B2A]',
        tagline: 'text-gray-500',
        heading: 'text-gray-600',
        link: 'text-gray-600 hover:text-[#0D1B2A]',
        rule: 'border-gray-100',
        meta: 'text-gray-500',
      };

  return (
    <footer className={c.root} data-tone={dark ? 'dark' : 'light'}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Main grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className={`text-base font-bold tracking-widest block mb-2 ${c.brand}`}>
              NOETIA
            </Link>
            <p className={`text-sm leading-relaxed mb-4 ${c.tagline}`}>
              {f.tagline}
            </p>
            <a href="mailto:info@noetia.app" className={`text-sm transition ${c.link}`}>
              info@noetia.app
            </a>
          </div>

          {/* Plataforma */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${c.heading}`}>
              {f.platform}
            </p>
            <ul className="space-y-2.5">
              {f.links.platform.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className={`text-sm transition ${c.link}`}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${c.heading}`}>
              {f.company}
            </p>
            <ul className="space-y-2.5">
              {f.links.company.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className={`text-sm transition ${c.link}`}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${c.heading}`}>
              {f.legal}
            </p>
            <ul className="space-y-2.5">
              {f.links.legal.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className={`text-sm transition ${c.link}`}>
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="mailto:legal@noetia.app" className={`text-sm transition ${c.link}`}>
                  legal@noetia.app
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className={`border-t pt-6 ${c.rule}`}>
          <p className={`text-xs ${c.meta}`}>
            © {new Date().getFullYear()} Noetia
          </p>
        </div>
      </div>
    </footer>
  );
}
