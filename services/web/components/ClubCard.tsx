import Link from 'next/link';
import { Club } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';

export default function ClubCard({ club }: { club: Club }) {
  const { t } = useTranslation();
  return (
    <Link href={`/clubs/${club.id}`} className="block border rounded-xl p-4 hover:shadow-md transition group">
      <div className="flex gap-3 mb-2">
        {club.coverUrl ? (
          <img src={club.coverUrl} alt={club.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <h2 className="font-semibold text-sm truncate group-hover:text-blue-600 transition">{club.name}</h2>
          <p className="text-xs text-gray-400">{club.owner?.name}</p>
        </div>
        <span className="ml-auto text-base flex-shrink-0">{club.type === 'public' ? '🌐' : '🔒'}</span>
      </div>
      {club.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{club.description}</p>
      )}
      {club.tokenRequired && (
        <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">1 token</span>
      )}
    </Link>
  );
}
