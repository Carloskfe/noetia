'use client';

import { useEffect, useState } from 'react';
import { clubsApi, ClubMember, ClubRole } from '@/lib/clubs';
import { useTranslation } from '@/lib/i18n';

export default function ClubMembersPanel({ clubId, myUserId, isAdmin, onClose }: {
  clubId: string;
  myUserId: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = t.clubs.members;

  const [members, setMembers]   = useState<ClubMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [banTarget, setBanTarget] = useState<ClubMember | null>(null);

  useEffect(() => { load(); }, [clubId]);

  async function load() {
    setLoading(true);
    try { setMembers(await clubsApi.getMembers(clubId)); }
    finally { setLoading(false); }
  }

  async function updateRole(userId: string, role: ClubRole) {
    await clubsApi.updateRole(clubId, userId, role);
    await load();
  }

  async function remove(userId: string, ban: boolean) {
    await clubsApi.removeMember(clubId, userId, ban);
    setBanTarget(null);
    await load();
  }

  const roleLabel: Record<ClubRole, string> = {
    admin: c.roles.admin,
    moderator: c.roles.moderator,
    member: c.roles.member,
  };

  if (loading) return <div className="h-20 flex items-center justify-center"><div className="w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{c.title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label={t.common.close}>✕</button>
      </div>

      <ul className="space-y-2 max-h-60 overflow-y-auto">
        {members.map(m => (
          <li key={m.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex-shrink-0" />
              <span className="text-sm truncate">{m.user?.name}</span>
              <span className="text-xs text-gray-400">{roleLabel[m.role]}</span>
            </div>

            {isAdmin && m.userId !== myUserId && m.role !== 'admin' && (
              <div className="flex gap-1 flex-shrink-0">
                {m.role === 'member' ? (
                  <button onClick={() => updateRole(m.userId, 'moderator')} className="text-xs text-blue-500 hover:underline">{c.promote}</button>
                ) : (
                  <button onClick={() => updateRole(m.userId, 'member')} className="text-xs text-gray-400 hover:underline">{c.demote}</button>
                )}
                <span className="text-gray-200">|</span>
                <button onClick={() => setBanTarget(m)} className="text-xs text-red-400 hover:underline">{c.remove}</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Ban/Remove modal */}
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-bold mb-2">{banTarget.user?.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{c.banConfirm}</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => remove(banTarget.userId, false)} className="border rounded-lg py-2 text-sm hover:bg-gray-50 transition">{c.remove}</button>
              <button onClick={() => remove(banTarget.userId, true)} className="bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 transition">{c.ban}</button>
              <button onClick={() => setBanTarget(null)} className="text-sm text-gray-400 hover:text-gray-600 mt-1">{t.common.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
