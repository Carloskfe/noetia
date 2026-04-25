'use client';

type Props = {
  phraseCount: number;
  onSave: () => void;
  onCancel: () => void;
  dark?: boolean;
};

export default function FragmentPopover({ phraseCount, onSave, onCancel, dark = false }: Props) {
  return (
    <div className={[
      'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-xl shadow-lg px-5 py-4 flex flex-col items-center gap-3 min-w-[220px]',
      dark ? 'bg-gray-900 border border-gray-700 text-gray-100' : 'bg-white border border-gray-200',
    ].join(' ')}>
      <p className={['text-sm font-medium text-center', dark ? 'text-gray-100' : 'text-gray-700'].join(' ')}>
        {phraseCount} frase{phraseCount !== 1 ? 's' : ''} seleccionada{phraseCount !== 1 ? 's' : ''}
      </p>
      <div className="flex gap-2 w-full">
        <button
          onClick={onSave}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition"
        >
          Guardar fragmento
        </button>
        <button
          onClick={onCancel}
          className={['flex-1 text-sm font-medium py-2 rounded-lg transition border', dark ? 'border-gray-600 hover:bg-gray-800 text-gray-200' : 'border-gray-200 hover:bg-gray-50 text-gray-700'].join(' ')}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
