import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { ClubMember } from './club-member.entity';
import { ClubSession } from './club-session.entity';
import { ClubMessage } from './club-message.entity';

interface RoomMember { userId: string; name: string; socketId: string }

interface RoomState {
  sessionId: string;
  clubId: string;
  hostId: string;
  isPlaying: boolean;
  positionMs: number;
  updatedAt: number;
  members: Map<string, RoomMember>;
}

interface PlaybackPayload { sessionId: string; positionMs?: number }
interface ChatPayload     { sessionId: string; content: string }
interface JoinPayload     { sessionId: string }

@WebSocketGateway({
  namespace: '/sessions',
  cors: { origin: '*', credentials: true },
})
export class ClubSessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private rooms = new Map<string, RoomState>();
  private socketSession = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(ClubMember)  private readonly memberRepo: Repository<ClubMember>,
    @InjectRepository(ClubSession) private readonly sessionRepo: Repository<ClubSession>,
    @InjectRepository(ClubMessage) private readonly messageRepo: Repository<ClubMessage>,
  ) {}

  // ── Connection lifecycle ────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    const raw = (client.handshake.auth?.token as string) ?? (client.handshake.headers?.authorization as string);
    const token = raw?.replace(/^Bearer\s+/, '');
    if (!token) { client.disconnect(); return; }

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token);
      client.data.userId = payload.sub;
      client.data.email  = payload.email;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const sessionId = this.socketSession.get(client.id);
    if (!sessionId) return;
    const room = this.rooms.get(sessionId);
    if (room) {
      room.members.delete(client.id);
      this.server.to(sessionId).emit('session:members', this.memberList(room));
    }
    this.socketSession.delete(client.id);
  }

  // ── Join / Leave ────────────────────────────────────────────────────────────

  @SubscribeMessage('join-session')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinPayload) {
    const userId = client.data.userId as string;
    const { sessionId } = payload;

    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) { client.emit('error', { message: 'Session not found' }); return; }

    const member = await this.memberRepo.findOne({ where: { clubId: session.clubId, userId, status: 'active' } });
    if (!member) { client.emit('error', { message: 'Not a club member' }); return; }

    if (!this.rooms.has(sessionId)) {
      this.rooms.set(sessionId, {
        sessionId,
        clubId: session.clubId,
        hostId: session.hostId,
        isPlaying: false,
        positionMs: 0,
        updatedAt: Date.now(),
        members: new Map(),
      });
    }

    const room = this.rooms.get(sessionId)!;
    room.members.set(client.id, { userId, name: client.data.email, socketId: client.id });
    this.socketSession.set(client.id, sessionId);
    client.join(sessionId);

    client.emit('session:state', {
      isPlaying: room.isPlaying,
      positionMs: room.positionMs,
      hostId: room.hostId,
      members: this.memberList(room),
    });
    this.server.to(sessionId).emit('session:members', this.memberList(room));
  }

  @SubscribeMessage('leave-session')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId: string }) {
    client.leave(payload.sessionId);
    this.handleDisconnect(client);
  }

  // ── Playback control (host only) ────────────────────────────────────────────

  @SubscribeMessage('playback:play')
  handlePlay(@ConnectedSocket() client: Socket, @MessageBody() payload: PlaybackPayload) {
    const room = this.getRoom(client, payload.sessionId);
    if (!room) return;
    if (room.hostId !== (client.data.userId as string)) return;
    room.isPlaying = true;
    room.positionMs = payload.positionMs ?? room.positionMs;
    room.updatedAt  = Date.now();
    this.server.to(payload.sessionId).emit('playback:state', { isPlaying: true, positionMs: room.positionMs });
  }

  @SubscribeMessage('playback:pause')
  handlePause(@ConnectedSocket() client: Socket, @MessageBody() payload: PlaybackPayload) {
    const room = this.getRoom(client, payload.sessionId);
    if (!room) return;
    if (room.hostId !== (client.data.userId as string)) return;
    room.isPlaying = false;
    room.positionMs = payload.positionMs ?? room.positionMs;
    room.updatedAt  = Date.now();
    this.server.to(payload.sessionId).emit('playback:state', { isPlaying: false, positionMs: room.positionMs });
  }

  @SubscribeMessage('playback:seek')
  handleSeek(@ConnectedSocket() client: Socket, @MessageBody() payload: PlaybackPayload) {
    const room = this.getRoom(client, payload.sessionId);
    if (!room) return;
    if (room.hostId !== (client.data.userId as string)) return;
    room.positionMs = payload.positionMs ?? 0;
    room.updatedAt  = Date.now();
    this.server.to(payload.sessionId).emit('playback:state', { isPlaying: room.isPlaying, positionMs: room.positionMs });
  }

  // ── Live chat ────────────────────────────────────────────────────────────────

  @SubscribeMessage('chat:message')
  async handleChatMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: ChatPayload) {
    const room = this.getRoom(client, payload.sessionId);
    if (!room) return;
    if (!payload.content?.trim()) return;

    const saved = await this.messageRepo.save(
      this.messageRepo.create({ clubId: room.clubId, userId: client.data.userId, content: payload.content.trim() }),
    );

    this.server.to(payload.sessionId).emit('chat:message', {
      id: saved.id,
      userId: saved.userId,
      content: saved.content,
      createdAt: saved.createdAt,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private getRoom(client: Socket, sessionId: string): RoomState | null {
    const room = this.rooms.get(sessionId);
    if (!room) { client.emit('error', { message: 'Room not found' }); return null; }
    return room;
  }

  private memberList(room: RoomState) {
    return Array.from(room.members.values()).map(m => ({ userId: m.userId, socketId: m.socketId }));
  }
}
