'use client';

import { useEffect, useState } from 'react';
import { hasSeenWelcome, markWelcomeSeen } from '@/lib/tutorial-flags';

export default function WelcomeSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token && !hasSeenWelcome()) setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    markWelcomeSeen();
    setShow(false);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0D1B2A] px-6 text-center"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenido a Noetia"
    >
      <h1 className="text-4xl font-bold tracking-widest text-white mb-2">NOETIA</h1>
      <p className="text-slate-400 text-sm mb-12">Lee. Escucha. Captura. Comparte.</p>

      <p className="text-white text-xl font-semibold leading-snug max-w-xs mb-4">
        La forma más poderosa de adquirir y compartir conocimiento e inspiración.
      </p>
      <p className="text-slate-300 text-sm leading-relaxed max-w-xs mb-12">
        Sincroniza texto y audio frase por frase, guarda lo que te mueve y conviértelo en tarjetas visuales para compartir.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs mb-12">
        {[
          { icon: '📖', label: 'Lee con sincronización frase a frase' },
          { icon: '🎧', label: 'Escucha mientras sigues el texto' },
          { icon: '✍️', label: 'Captura fragmentos que te inspiran' },
          { icon: '📲', label: 'Comparte en LinkedIn, Instagram y más' },
          { icon: '👥', label: 'Lee junto a otros en Noetia Clubs' },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-3 text-left">
            <span className="text-xl w-8 shrink-0">{icon}</span>
            <span className="text-slate-300 text-sm">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={dismiss}
        className="w-full max-w-xs bg-white text-[#0D1B2A] font-semibold py-3.5 rounded-xl hover:bg-slate-100 transition"
      >
        Comenzar a leer
      </button>
    </div>
  );
}
