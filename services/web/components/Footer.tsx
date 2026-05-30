import Link from 'next/link';

const CORPORATE = [
  { href: '/about', label: 'Sobre Noetia' },
  { href: '/company', label: 'Empresa' },
  { href: '/how-we-build', label: 'Cómo construimos' },
  { href: '/team', label: 'Equipo' },
  { href: '/careers', label: 'Carreras' },
  { href: '/milestones', label: 'Hitos' },
  { href: '/contact', label: 'Contacto' },
];

const PRODUCT = [
  { href: '/library', label: 'Biblioteca' },
  { href: '/clubs', label: 'Clubes de lectura' },
  { href: '/causas', label: 'Causas Noetia' },
  { href: '/pricing', label: 'Planes' },
  { href: '/upload-guide', label: 'Para autores' },
];

const LEGAL = [
  { href: '/legal/privacy', label: 'Privacidad' },
  { href: '/legal/terms', label: 'Términos de uso' },
  { href: '/legal/cookies', label: 'Cookies' },
  { href: '/trust', label: 'Confianza y seguridad' },
];

export default function Footer() {
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
              Where knowledge becomes visible.
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
              Plataforma
            </p>
            <ul className="space-y-2.5">
              {PRODUCT.map(({ href, label }) => (
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
              Empresa
            </p>
            <ul className="space-y-2.5">
              {CORPORATE.map(({ href, label }) => (
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
              Legal
            </p>
            <ul className="space-y-2.5">
              {LEGAL.map(({ href, label }) => (
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
