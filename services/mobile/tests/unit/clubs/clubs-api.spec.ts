import { clubsApi } from '../../../src/api/clubs';
import { apiClient } from '../../../src/api/client';

jest.mock('../../../src/api/client', () => ({
  apiClient: {
    get:    jest.fn(),
    post:   jest.fn(),
    patch:  jest.fn(),
    delete: jest.fn(),
  },
}));

const mockClient = apiClient as jest.Mocked<typeof apiClient>;

describe('clubsApi', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('list', () => {
    it('calls /clubs without params', async () => {
      mockClient.get.mockResolvedValue({ clubs: [] });
      await clubsApi.list();
      expect(mockClient.get).toHaveBeenCalledWith('/clubs');
    });

    it('appends search param when provided', async () => {
      mockClient.get.mockResolvedValue({ clubs: [] });
      await clubsApi.list('García');
      expect(mockClient.get).toHaveBeenCalledWith('/clubs?search=Garc%C3%ADa');
    });
  });

  describe('get', () => {
    it('fetches a single club', async () => {
      mockClient.get.mockResolvedValue({ id: 'c1', name: 'Test' });
      const result = await clubsApi.get('c1');
      expect(mockClient.get).toHaveBeenCalledWith('/clubs/c1');
      expect(result).toMatchObject({ id: 'c1' });
    });
  });

  describe('join / leave', () => {
    it('joins a club', async () => {
      mockClient.post.mockResolvedValue({});
      await clubsApi.join('c1');
      expect(mockClient.post).toHaveBeenCalledWith('/clubs/c1/join');
    });

    it('leaves a club', async () => {
      mockClient.delete.mockResolvedValue({});
      await clubsApi.leave('c1');
      expect(mockClient.delete).toHaveBeenCalledWith('/clubs/c1/members/me');
    });
  });

  describe('messages', () => {
    it('fetches messages without cursor', async () => {
      mockClient.get.mockResolvedValue([]);
      await clubsApi.getMessages('c1');
      expect(mockClient.get).toHaveBeenCalledWith('/clubs/c1/messages');
    });

    it('appends before param when provided', async () => {
      mockClient.get.mockResolvedValue([]);
      await clubsApi.getMessages('c1', '2026-01-01');
      expect(mockClient.get).toHaveBeenCalledWith('/clubs/c1/messages?before=2026-01-01');
    });

    it('sends a message', async () => {
      mockClient.post.mockResolvedValue({ id: 'm1', content: 'hello' });
      const r = await clubsApi.sendMessage('c1', 'hello');
      expect(mockClient.post).toHaveBeenCalledWith('/clubs/c1/messages', { content: 'hello' });
      expect(r).toMatchObject({ content: 'hello' });
    });

    it('deletes a message', async () => {
      mockClient.delete.mockResolvedValue({});
      await clubsApi.deleteMessage('c1', 'm1');
      expect(mockClient.delete).toHaveBeenCalledWith('/clubs/c1/messages/m1');
    });
  });

  describe('discussions', () => {
    it('posts a discussion comment', async () => {
      mockClient.post.mockResolvedValue({ id: 'd1', phraseIndex: 42 });
      const r = await clubsApi.postDiscussion('c1', 'b1', 42, 'great passage');
      expect(mockClient.post).toHaveBeenCalledWith('/clubs/c1/discussions', { bookId: 'b1', phraseIndex: 42, content: 'great passage' });
      expect(r).toMatchObject({ phraseIndex: 42 });
    });

    it('deletes a discussion', async () => {
      mockClient.delete.mockResolvedValue({});
      await clubsApi.deleteDiscussion('c1', 'd1');
      expect(mockClient.delete).toHaveBeenCalledWith('/clubs/c1/discussions/d1');
    });
  });

  describe('polls', () => {
    it('casts a vote', async () => {
      mockClient.post.mockResolvedValue({});
      await clubsApi.vote('c1', 'p1', 'opt1');
      expect(mockClient.post).toHaveBeenCalledWith('/clubs/c1/polls/p1/vote', { optionId: 'opt1' });
    });

    it('closes a poll', async () => {
      mockClient.post.mockResolvedValue({});
      await clubsApi.closePoll('c1', 'p1');
      expect(mockClient.post).toHaveBeenCalledWith('/clubs/c1/polls/p1/close');
    });
  });

  describe('sessions', () => {
    it('cancels a session', async () => {
      mockClient.delete.mockResolvedValue({});
      await clubsApi.cancelSession('c1', 's1');
      expect(mockClient.delete).toHaveBeenCalledWith('/clubs/c1/sessions/s1');
    });
  });

  describe('acceptInvite', () => {
    it('posts token to accept endpoint', async () => {
      mockClient.post.mockResolvedValue({});
      await clubsApi.acceptInvite('c1', 'jwt-token');
      expect(mockClient.post).toHaveBeenCalledWith('/clubs/c1/accept', { token: 'jwt-token' });
    });
  });
});
