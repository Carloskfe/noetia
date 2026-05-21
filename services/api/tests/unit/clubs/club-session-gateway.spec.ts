import { ClubSessionGateway } from '../../../src/clubs/club-session.gateway';

const mockJwt      = { verify: jest.fn() };
const mockMemberRepo  = { findOne: jest.fn() };
const mockSessionRepo = { findOne: jest.fn() };
const mockMessageRepo = { create: jest.fn(v => v), save: jest.fn(async v => ({ ...v, id: 'msg-1', createdAt: new Date() })) };

function makeGateway() {
  return new ClubSessionGateway(
    mockJwt as any,
    mockMemberRepo as any,
    mockSessionRepo as any,
    mockMessageRepo as any,
  );
}

function makeSocket(userId = 'u1', overrides?: object): any {
  return {
    id: 'socket-1',
    data: { userId },
    handshake: { auth: { token: 'Bearer tok' }, headers: {} },
    disconnect: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    ...overrides,
  };
}

describe('ClubSessionGateway', () => {
  let gw: ClubSessionGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gw = makeGateway();
    (gw as any).server = { to: jest.fn(() => ({ emit: jest.fn() })), emit: jest.fn() };
  });

  describe('handleConnection', () => {
    it('stores userId on successful JWT verify', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'u1', email: 'u@test.com' });
      const client = makeSocket();
      await gw.handleConnection(client);
      expect(client.data.userId).toBe('u1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects when no token', async () => {
      const client = makeSocket('', { handshake: { auth: {}, headers: {} } });
      await gw.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when JWT invalid', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      const client = makeSocket();
      await gw.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleJoin', () => {
    it('creates room and sends state when valid member', async () => {
      mockSessionRepo.findOne.mockResolvedValue({ id: 's1', clubId: 'c1', hostId: 'u1' });
      mockMemberRepo.findOne.mockResolvedValue({ role: 'member', status: 'active' });
      const client = makeSocket('u1');

      await gw.handleJoin(client, { sessionId: 's1' });

      expect(client.join).toHaveBeenCalledWith('s1');
      expect(client.emit).toHaveBeenCalledWith('session:state', expect.objectContaining({ hostId: 'u1', isPlaying: false }));
    });

    it('emits error when session not found', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      const client = makeSocket('u1');
      await gw.handleJoin(client, { sessionId: 'missing' });
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Session not found' });
    });

    it('emits error when not a club member', async () => {
      mockSessionRepo.findOne.mockResolvedValue({ id: 's1', clubId: 'c1', hostId: 'u1' });
      mockMemberRepo.findOne.mockResolvedValue(null);
      const client = makeSocket('u2');
      await gw.handleJoin(client, { sessionId: 's1' });
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Not a club member' });
    });
  });

  describe('handlePlay / handlePause / handleSeek', () => {
    function seedRoom(sessionId = 's1', hostId = 'u1') {
      const rooms: Map<string, any> = (gw as any).rooms;
      rooms.set(sessionId, {
        sessionId, clubId: 'c1', hostId,
        isPlaying: false, positionMs: 0, updatedAt: Date.now(),
        members: new Map(),
      });
    }

    it('play broadcasts state to room (host only)', () => {
      seedRoom('s1', 'u1');
      const client = makeSocket('u1');
      gw.handlePlay(client, { sessionId: 's1', positionMs: 5000 });
      expect((gw as any).server.to).toHaveBeenCalledWith('s1');
    });

    it('non-host cannot play', () => {
      seedRoom('s1', 'u1');
      const client = makeSocket('u2');
      gw.handlePlay(client, { sessionId: 's1', positionMs: 0 });
      expect((gw as any).server.to).not.toHaveBeenCalled();
    });

    it('pause updates room state', () => {
      seedRoom('s1', 'u1');
      const rooms: Map<string, any> = (gw as any).rooms;
      rooms.get('s1')!.isPlaying = true;
      gw.handlePause(makeSocket('u1'), { sessionId: 's1', positionMs: 3000 });
      expect(rooms.get('s1')!.isPlaying).toBe(false);
    });

    it('seek updates positionMs', () => {
      seedRoom('s1', 'u1');
      gw.handleSeek(makeSocket('u1'), { sessionId: 's1', positionMs: 12000 });
      const rooms: Map<string, any> = (gw as any).rooms;
      expect(rooms.get('s1')!.positionMs).toBe(12000);
    });
  });

  describe('handleChatMessage', () => {
    it('saves message and broadcasts to room', async () => {
      const rooms: Map<string, any> = (gw as any).rooms;
      rooms.set('s1', { sessionId: 's1', clubId: 'c1', hostId: 'u1', isPlaying: false, positionMs: 0, updatedAt: 0, members: new Map() });

      const client = makeSocket('u1');
      await gw.handleChatMessage(client, { sessionId: 's1', content: 'hello' });

      expect(mockMessageRepo.save).toHaveBeenCalled();
      expect((gw as any).server.to).toHaveBeenCalledWith('s1');
    });

    it('ignores empty content', async () => {
      const rooms: Map<string, any> = (gw as any).rooms;
      rooms.set('s1', { sessionId: 's1', clubId: 'c1', hostId: 'u1', isPlaying: false, positionMs: 0, updatedAt: 0, members: new Map() });

      await gw.handleChatMessage(makeSocket('u1'), { sessionId: 's1', content: '   ' });
      expect(mockMessageRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('removes member from room on disconnect', async () => {
      const rooms: Map<string, any> = (gw as any).rooms;
      const socketSess: Map<string, string> = (gw as any).socketSession;
      rooms.set('s1', { sessionId: 's1', clubId: 'c1', hostId: 'u1', isPlaying: false, positionMs: 0, updatedAt: 0, members: new Map([['socket-1', { userId: 'u1' }]]) });
      socketSess.set('socket-1', 's1');

      gw.handleDisconnect(makeSocket('u1'));
      expect(rooms.get('s1')!.members.has('socket-1')).toBe(false);
    });
  });
});
