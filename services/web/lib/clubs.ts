import { apiFetch } from './api';

export type ClubType = 'public' | 'private' | 'author_event';
export type ClubRole = 'admin' | 'moderator' | 'member';
export type MemberStatus = 'active' | 'banned';
export type ClubBookStatus = 'active' | 'completed' | 'queued';
export type PollStatus = 'open' | 'closed';
export type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface Club {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  type: ClubType;
  ownerId: string;
  approvalRequired: boolean;
  tokenRequired: boolean;
  maxMembers: number | null;
  createdAt: string;
  owner: { id: string; name: string };
}

export interface ClubMember {
  id: string;
  clubId: string;
  userId: string;
  role: ClubRole;
  status: MemberStatus;
  notifNearbyComment: boolean;
  notifNewBook: boolean;
  notifMilestone: boolean;
  notifSession: boolean;
  notifConfigured: boolean;
  joinedAt: string;
  user: { id: string; name: string; avatarUrl?: string };
}

export interface ClubBook {
  id: string;
  clubId: string;
  bookId: string;
  status: ClubBookStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  book: { id: string; title: string; author: string; coverUrl: string | null };
}

export interface ClubMessage {
  id: string;
  clubId: string;
  userId: string;
  content: string;
  deletedAt: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

export interface ClubDiscussion {
  id: string;
  clubId: string;
  bookId: string;
  userId: string;
  phraseIndex: number;
  content: string;
  deletedAt: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

export interface ClubPoll {
  id: string;
  clubId: string;
  question: string;
  status: PollStatus;
  closesAt: string;
  winnerOptionId: string | null;
  createdAt: string;
}

export interface ClubPollOption {
  id: string;
  pollId: string;
  bookId: string;
  book: { id: string; title: string; author: string };
  voteCount?: number;
}

export interface ClubSession {
  id: string;
  clubId: string;
  bookId: string;
  hostId: string;
  title: string;
  status: SessionStatus;
  scheduledAt: string;
  startPhraseIndex: number;
  endPhraseIndex: number;
  book: { id: string; title: string };
  host: { id: string; name: string };
}

// ── Clubs ─────────────────────────────────────────────────────────────────────

export const clubsApi = {
  list: (params?: { search?: string; bookId?: string; sort?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch(`/clubs${q ? `?${q}` : ''}`);
  },
  get: (id: string): Promise<Club> => apiFetch(`/clubs/${id}`),
  create: (body: { name: string; description?: string; type: 'public' | 'private'; bookId: string; approvalRequired?: boolean }) =>
    apiFetch('/clubs', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Club>) =>
    apiFetch(`/clubs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch(`/clubs/${id}`, { method: 'DELETE' }),

  // Members
  join: (id: string) => apiFetch(`/clubs/${id}/join`, { method: 'POST' }),
  leave: (id: string) => apiFetch(`/clubs/${id}/members/me`, { method: 'DELETE' }),
  getMembers: (id: string): Promise<ClubMember[]> => apiFetch(`/clubs/${id}/members`),
  generateInvite: (id: string): Promise<{ url: string }> => apiFetch(`/clubs/${id}/invite`, { method: 'POST' }),
  acceptInvite: (id: string, token: string) =>
    apiFetch(`/clubs/${id}/accept`, { method: 'POST', body: JSON.stringify({ token }) }),
  updateRole: (id: string, userId: string, role: ClubRole) =>
    apiFetch(`/clubs/${id}/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeMember: (id: string, userId: string, ban: boolean) =>
    apiFetch(`/clubs/${id}/members/${userId}`, { method: 'DELETE', body: JSON.stringify({ ban }) }),
  updateNotifications: (id: string, prefs: Partial<ClubMember>) =>
    apiFetch(`/clubs/${id}/notifications`, { method: 'PATCH', body: JSON.stringify(prefs) }),

  // Books
  getBooks: (id: string): Promise<ClubBook[]> => apiFetch(`/clubs/${id}/books`),
  addBook: (id: string, bookId: string) =>
    apiFetch(`/clubs/${id}/books`, { method: 'POST', body: JSON.stringify({ bookId }) }),
  activateBook: (id: string, bookId: string) =>
    apiFetch(`/clubs/${id}/books/${bookId}/activate`, { method: 'PATCH' }),

  // Messages
  getMessages: (id: string, before?: string): Promise<ClubMessage[]> =>
    apiFetch(`/clubs/${id}/messages${before ? `?before=${before}` : ''}`),
  sendMessage: (id: string, content: string) =>
    apiFetch(`/clubs/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  deleteMessage: (id: string, msgId: string) =>
    apiFetch(`/clubs/${id}/messages/${msgId}`, { method: 'DELETE' }),

  // Discussions
  getDiscussions: (id: string, bookId: string, phraseFrom?: number, phraseTo?: number): Promise<ClubDiscussion[]> => {
    const q = new URLSearchParams();
    if (phraseFrom !== undefined) q.set('phraseFrom', String(phraseFrom));
    if (phraseTo   !== undefined) q.set('phraseTo',   String(phraseTo));
    return apiFetch(`/clubs/${id}/discussions/${bookId}${q.toString() ? `?${q}` : ''}`);
  },
  postDiscussion: (id: string, body: { bookId: string; phraseIndex: number; content: string }) =>
    apiFetch(`/clubs/${id}/discussions`, { method: 'POST', body: JSON.stringify(body) }),
  deleteDiscussion: (id: string, discussionId: string) =>
    apiFetch(`/clubs/${id}/discussions/${discussionId}`, { method: 'DELETE' }),

  // Polls
  getPolls: (id: string): Promise<ClubPoll[]> => apiFetch(`/clubs/${id}/polls`),
  createPoll: (id: string, body: { question: string; bookIds: string[]; closesAt: string }) =>
    apiFetch(`/clubs/${id}/polls`, { method: 'POST', body: JSON.stringify(body) }),
  vote: (id: string, pollId: string, optionId: string) =>
    apiFetch(`/clubs/${id}/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) }),
  closePoll: (id: string, pollId: string) =>
    apiFetch(`/clubs/${id}/polls/${pollId}/close`, { method: 'POST' }),

  // Sessions
  getSessions: (id: string): Promise<ClubSession[]> => apiFetch(`/clubs/${id}/sessions`),
  createSession: (id: string, body: { bookId: string; title: string; scheduledAt: string; startPhraseIndex: number; endPhraseIndex: number }) =>
    apiFetch(`/clubs/${id}/sessions`, { method: 'POST', body: JSON.stringify(body) }),
  cancelSession: (id: string, sessionId: string) =>
    apiFetch(`/clubs/${id}/sessions/${sessionId}`, { method: 'DELETE' }),
};
