'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

export default function Footer() {
  const { t } = useTranslation();
  const f = t.footer;
  return (
    <footer className="border-t border-gray-100 bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Main grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-10">

          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="text-base font-bold tracking-widest text-[#0D1B2A] block mb-2">
              NOETIA
            </Link>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              {f.tagline}
            </p>
            <a
              href="mailto:info@noetia.app"
              className="text-xs text-gray-500 hover:text-[#0D1B2A] transition"
            >
              info@noetia.app
            </a>
          </div>

          {/* Plataforma */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
              {f.platform}
            </p>
            <ul className="space-y-2.5">
              {f.links.platform.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-gray-500 hover:text-[#0D1B2A] transition">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
              {f.company}
            </p>
            <ul className="space-y-2.5">
              {f.links.company.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-gray-500 hover:text-[#0D1B2A] transition">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
              {f.legal}
            </p>
            <ul className="space-y-2.5">
              {f.links.legal.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-gray-500 hover:text-[#0D1B2A] transition">
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="mailto:legal@noetia.app"
                  className="text-xs text-gray-500 hover:text-[#0D1B2A] transition"
                >
                  legal@noetia.app
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Noetia
          </p>
          <p className="text-xs text-gray-300">
            Knowledge Expression Platform
          </p>
        </div>

      </div>
    </footer>
  );
}
