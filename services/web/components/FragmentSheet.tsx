'use client';

import { useState } from 'react';
import { Fragment } from '@/lib/reader-utils';
import SharePicker from './SharePicker';
import SharePreviewModal from './SharePreviewModal';

type Props = {
  fragments: Fragment[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onCombine: (ids: string[]) => void;
  onNoteUpdate: (id: string, note: string) => void;
  dark?: boolean;
};

export default function FragmentSheet({ fragments, onClose, onDelete, onCombine, onNoteUpdate, dark = false }: Props) {
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [sharingFragmentId, setSharingFragmentId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitMultiSelect() {
    setMultiSelect(false);
    setSelected(new Set());
  }

  function handleCombine() {
    onCombine([...selected]);
    exitMultiSelect();
  }

  function startEditNote(f: Fragment) {
    setEditingNoteId(f.id);
    setNoteValue(f.note ?? '');
  }

  function saveNote(id: string) {
    onNoteUpdate(id, noteValue);
    setEditingNoteId(null);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className={['fixed top-0 right-0 h-full w-80 shadow-xl z-50 flex flex-col', dark ? 'bg-gray-900 text-gray-100' : 'bg-white'].join(' ')}>
        {/* Header */}
        <div className={['flex items-center justify-between px-5 py-4 border-b', dark ? 'border-gray-700' : 'border-gray-100'].join(' ')}>
          <h2 className={['text-base font-semibold', dark ? 'text-gray-100' : 'text-gray-900'].join(' ')}>Fragmentos</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (multiSelect) exitMultiSelect();
                else setMultiSelect(true);
              }}
              className={[
                'text-xs px-2.5 py-1 rounded-full border transition',
                multiSelect
                  ? 'border-blue-500 text-blue-400 bg-blue-950'
                  : dark
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              ].join(' ')}
            >
              {multiSelect ? 'Cancelar' : 'Seleccionar'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <XIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {fragments.length === 0 ? (
            <p className={['text-sm text-center mt-8', dark ? 'text-gray-500' : 'text-gray-400'].join(' ')}>
              No hay fragmentos guardados para este libro.
            </p>
          ) : (
            fragments.map((f) => (
              <div
                key={f.id}
                className={['border rounded-xl p-3 space-y-2', dark ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'].join(' ')}
              >
                <div className="flex items-start gap-2">
                  {multiSelect && (
                    <input
                      type="checkbox"
                      checked={selected.has(f.id)}
                      onChange={() => toggleSelect(f.id)}
                      className="mt-1 accent-blue-600"
                    />
                  )}
                  <p className={['flex-1 text-sm leading-snug line-clamp-3', dark ? 'text-gray-200' : 'text-gray-800'].join(' ')}>{f.text}</p>
                  {!multiSelect && (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => setSharingFragmentId(f.id)}
                        className="text-gray-300 hover:text-blue-500 transition"
                        aria-label="Compartir fragmento"
                      >
                        <ShareIcon />
                      </button>
                      <button
                        onClick={() => onDelete(f.id)}
                        className="text-gray-300 hover:text-red-400 transition"
                        aria-label="Eliminar fragmento"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </div>

                {/* Note */}
                {editingNoteId === f.id ? (
                  <div className="space-y-1">
                    <textarea
                      value={noteValue}
                      onChange={(e) => setNoteValue(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveNote(f.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditNote(f)}
                    className={['text-xs transition text-left', dark ? 'text-gray-500 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'].join(' ')}
                  >
                    {f.note ? f.note : '+ Añadir nota'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Combine button */}
        {multiSelect && selected.size >= 2 && (
          <div className={['px-4 py-3 border-t', dark ? 'border-gray-700' : 'border-gray-100'].join(' ')}>
            <button
              onClick={handleCombine}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition"
            >
              Combinar ({selected.size})
            </button>
          </div>
        )}
      </aside>

      {sharingFragmentId && (
        <SharePicker
          fragmentId={sharingFragmentId}
          onClose={() => setSharingFragmentId(null)}
          onSuccess={(url) => {
            setSharingFragmentId(null);
            setShareUrl(url);
          }}
        />
      )}

      {shareUrl && (
        <SharePreviewModal
          url={shareUrl}
          onClose={() => setShareUrl(null)}
        />
      )}
    </>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
