import { apiClient } from './client';

export type ClubType     = 'public' | 'private' | 'author_event';
export type ClubRole     = 'admin' | 'moderator' | 'member';
export type PollStatus   = 'open' | 'closed';
export type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface Club {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  type: ClubType;
  ownerId: string;
  tokenRequired: boolean;
  maxMembers: number | null;
  owner: { id: string; name: string };
}

export interface ClubMember {
  id: string;
  clubId: string;
  userId: string;
  role: ClubRole;
  status: 'active' | 'banned';
  joinedAt: string;
  user: { id: string; name: string };
}

export interface ClubBook {
  id: string;
  bookId: string;
  status: 'active' | 'completed' | 'queued';
  book: { id: string; title: string; author: string };
}

export interface ClubMessage {
  id: string;
  userId: string;
  content: string;
  deletedAt: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

export interface ClubDiscussion {
  id: string;
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
  question: string;
  status: PollStatus;
  closesAt: string;
  winnerOptionId: string | null;
}

export interface ClubSession {
  id: string;
  title: string;
  status: SessionStatus;
  scheduledAt: string;
  startPhraseIndex: number;
  endPhraseIndex: number;
  book: { id: string; title: string };
}

export const clubsApi = {
  list: (search?: string) =>
    apiClient.get<{ clubs: Club[] }>(`/clubs${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  getMyClubs: () =>
    apiClient.get<ClubMember[]>('/clubs/members/me').catch(() => [] as ClubMember[]),

  get: (id: string) => apiClient.get<Club>(`/clubs/${id}`),

  join: (id: string) => apiClient.post(`/clubs/${id}/join`),
  leave: (id: string) => apiClient.delete(`/clubs/${id}/members/me`),
  acceptInvite: (id: string, token: string) =>
    apiClient.post(`/clubs/${id}/accept`, { token }),

  getMembers: (id: string) => apiClient.get<ClubMember[]>(`/clubs/${id}/members`),
  getBooks:   (id: string) => apiClient.get<ClubBook[]>(`/clubs/${id}/books`),

  getMessages: (id: string, before?: string) =>
    apiClient.get<ClubMessage[]>(`/clubs/${id}/messages${before ? `?before=${before}` : ''}`),
  sendMessage: (id: string, content: string) =>
    apiClient.post<ClubMessage>(`/clubs/${id}/messages`, { content }),
  deleteMessage: (id: string, msgId: string) =>
    apiClient.delete(`/clubs/${id}/messages/${msgId}`),

  getDiscussions: (id: string, bookId: string) =>
    apiClient.get<ClubDiscussion[]>(`/clubs/${id}/discussions/${bookId}`),
  postDiscussion: (id: string, bookId: string, phraseIndex: number, content: string) =>
    apiClient.post<ClubDiscussion>(`/clubs/${id}/discussions`, { bookId, phraseIndex, content }),
  deleteDiscussion: (id: string, discussionId: string) =>
    apiClient.delete(`/clubs/${id}/discussions/${discussionId}`),

  getPolls:  (id: string) => apiClient.get<ClubPoll[]>(`/clubs/${id}/polls`),
  vote:      (id: string, pollId: string, optionId: string) =>
    apiClient.post(`/clubs/${id}/polls/${pollId}/vote`, { optionId }),
  closePoll: (id: string, pollId: string) =>
    apiClient.post(`/clubs/${id}/polls/${pollId}/close`),

  getSessions:   (id: string) => apiClient.get<ClubSession[]>(`/clubs/${id}/sessions`),
  cancelSession: (id: string, sessionId: string) =>
    apiClient.delete(`/clubs/${id}/sessions/${sessionId}`),
};
