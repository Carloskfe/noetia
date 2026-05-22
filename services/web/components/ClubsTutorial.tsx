'use client';

import { useEffect, useState } from 'react';
import { hasSeenClubsTutorial, markClubsTutorialSeen } from '@/lib/tutorial-flags';

export default function ClubsTutorial() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!hasSeenClubsTutorial()) setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    markClubsTutorialSeen();
    setShow(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={dismiss} aria-hidden="true" />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-2xl shadow-2xl px-6 pt-5 pb-8 max-w-lg mx-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Tutorial de Clubes de Lectura"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <h2 className="text-lg font-bold text-gray-900 mb-1">Clubes de Lectura</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Para quienes quieren dejar de leer en soledad. Lee, escucha y expande tus ideas junto a otros.
        </p>

        <div className="space-y-4 mb-8">
          {[
            {
              icon: '🔍',
              title: 'Encuentra tu club',
              body: 'Explora clubes públicos, busca por título o tema y únete a la conversación en segundos.',
            },
            {
              icon: '💬',
              title: 'Discute frase a frase',
              body: 'Cada comentario vive en la frase exacta que lo inspiró — no en el capítulo. La conversación tiene contexto.',
            },
            {
              icon: '🎧',
              title: 'Escucha Juntos',
              body: 'Únete a sesiones en vivo donde todos escuchan la misma frase al mismo tiempo. Leer juntos, de verdad.',
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <span className="text-xl mt-0.5 w-7 shrink-0">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition"
        >
          Explorar clubes
        </button>
      </div>
    </>
  );
}
