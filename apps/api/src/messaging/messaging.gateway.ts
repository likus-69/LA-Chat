import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WebSocket } from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from './messages.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import {
  WsClientEvent,
  WsServerEvent,
  WsSendMessagePayload,
  WsEditMessagePayload,
  WsReactPayload,
  WsTypingPayload,
  WsMarkReadPayload,
  AccountStatus,
} from '@la-chat/shared-types';
import { JwtPayload } from '../auth/auth.types';

/**
 * Real-time messaging gateway.
 *
 * Transport: raw WebSocket (ws) on the same origin as the REST API, at path
 * /ws. Auth via JWT passed in the Sec-WebSocket-Protocol header (the only
 * header a browser can set on the WS handshake).
 *
 * Message envelope (client → server):
 *   { "event": "message.send", "data": { ... } }
 *
 * Message envelope (server → client):
 *   { "event": "message.new", "data": { ... } }
 *
 * Rooms: we maintain an in-memory map of conversationId → Set<WebSocket>
 * because raw `ws` doesn't have built-in rooms. This is sufficient for a
 * single-server deployment; for multi-instance we'd move to Redis pub/sub.
 */
@WebSocketGateway({
  path: '/ws',
  cors: { origin: '*', credentials: true }, // tightened by Caddy in prod
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('MessagingGateway');

  @WebSocketServer() server!: import('ws').WebSocketServer;

  /** conversationId → set of connected sockets in that room */
  private rooms = new Map<string, Set<WebSocket>>();

  /** socket → authenticated user id (for cleanup on disconnect) */
  private socketUser = new Map<WebSocket, { userId: string; joinedConversations: Set<string> }>();

  /** user id → set of sockets (one user may have multiple devices) */
  private userSockets = new Map<string, Set<WebSocket>>();

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private messages: MessagesService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private push: PushService,
  ) {}

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  async handleConnection(client: WebSocket, ...args: any[]): Promise<void> {
    // Extract the JWT. With `ws`, the second arg is the IncomingMessage.
    const req = args[0] as import('http').IncomingMessage | undefined;
    let token: string | undefined;

    // Try Sec-WebSocket-Protocol first: client opens with new WebSocket(url, ['jwt.<token>'])
    const protocols = (req?.headers['sec-websocket-protocol'] as string | undefined)?.split(',').map((s) => s.trim());
    if (protocols && protocols.length > 0) {
      const jwtProto = protocols.find((p) => p.startsWith('jwt.'));
      if (jwtProto) token = jwtProto.slice('jwt.'.length);
    }
    // Fallback: ?token= query param (used by curl/wscat for debugging)
    if (!token && req?.url) {
      const url = new URL(req.url, 'http://localhost');
      token = url.searchParams.get('token') ?? undefined;
    }

    if (!token) {
      this.send(client, WsServerEvent.ERROR, { code: 'NO_TOKEN', message: 'Authentication required' });
      client.close(1008, 'auth required');
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET', 'dev-only-insecure-secret-change-me'),
      });
    } catch {
      this.send(client, WsServerEvent.ERROR, { code: 'BAD_TOKEN', message: 'Invalid or expired token' });
      client.close(1008, 'bad token');
      return;
    }

    if (payload.status !== AccountStatus.ACTIVE) {
      this.send(client, WsServerEvent.ERROR, { code: 'INACTIVE', message: 'Account not active' });
      client.close(1008, 'inactive');
      return;
    }

    const userId = payload.sub;
    this.socketUser.set(client, { userId, joinedConversations: new Set() });
    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
    this.userSockets.get(userId)!.add(client);

    // Mark all SENT messages as DELIVERED for this user
    await this.messages.markDeliveredOnConnect(userId).catch((e) =>
      this.logger.warn(`markDeliveredOnConnect failed: ${(e as Error).message}`),
    );

    this.send(client, WsServerEvent.AUTHORIZED, { userId });
    this.logger.log(`Connected: user ${userId} (${this.userSockets.get(userId)!.size} sockets total)`);
  }

  handleDisconnect(client: WebSocket): void {
    const meta = this.socketUser.get(client);
    if (!meta) return;
    const { userId, joinedConversations } = meta;

    // Leave all rooms
    for (const convId of joinedConversations) {
      this.leaveRoom(client, convId);
    }

    // Remove from userSockets
    const userSet = this.userSockets.get(userId);
    if (userSet) {
      userSet.delete(client);
      if (userSet.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.socketUser.delete(client);
    this.logger.log(`Disconnected: user ${userId} (${this.userSockets.get(userId)?.size ?? 0} sockets remaining)`);
  }

  // -------------------------------------------------------------------------
  // Room management
  // -------------------------------------------------------------------------

  @SubscribeMessage(WsClientEvent.JOIN_CONVERSATION)
  async onJoin(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsTypingPayload,
  ): Promise<void> {
    const meta = this.requireAuth(client);
    await this.assertParticipant(meta.userId, body.conversationId);
    this.joinRoom(client, body.conversationId);
    meta.joinedConversations.add(body.conversationId);
  }

  @SubscribeMessage(WsClientEvent.LEAVE_CONVERSATION)
  async onLeave(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsTypingPayload,
  ): Promise<void> {
    const meta = this.requireAuth(client);
    this.leaveRoom(client, body.conversationId);
    meta.joinedConversations.delete(body.conversationId);
  }

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  @SubscribeMessage(WsClientEvent.SEND_MESSAGE)
  async onSend(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsSendMessagePayload,
  ): Promise<void> {
    const meta = this.requireAuth(client);
    try {
      const { message, created } = await this.messages.send({
        conversationId: body.conversationId,
        senderId: meta.userId,
        clientMessageId: body.clientMessageId,
        type: body.type,
        body: body.body,
        replyToId: body.replyToId,
        assetIds: body.assetIds,
      });

      // Ack the sender with the authoritative message
      this.send(client, WsServerEvent.MESSAGE_NEW, { message, echoed: true });

      // Broadcast to everyone else in the room (other participants online)
      this.broadcast(body.conversationId, client, WsServerEvent.MESSAGE_NEW, { message });

      // Also push to any other devices the sender has open
      this.sendToUser(meta.userId, client, WsServerEvent.MESSAGE_NEW, { message, echoed: true });

      // Push notification to offline participants (Phase 4)
      this.queuePushForOfflineParticipants(body.conversationId, meta.userId, message).catch(() => {});
    } catch (e) {
      this.sendError(client, (e as Error).message);
    }
  }

  @SubscribeMessage(WsClientEvent.EDIT_MESSAGE)
  async onEdit(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsEditMessagePayload,
  ): Promise<void> {
    const meta = this.requireAuth(client);
    try {
      const message = await this.messages.edit(meta.userId, body.messageId, body.body);
      this.send(client, WsServerEvent.MESSAGE_EDITED, { message });
      this.broadcast(message.conversationId, client, WsServerEvent.MESSAGE_EDITED, { message });
    } catch (e) {
      this.sendError(client, (e as Error).message);
    }
  }

  @SubscribeMessage(WsClientEvent.DELETE_MESSAGE)
  async onDelete(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: { messageId: string },
  ): Promise<void> {
    const meta = this.requireAuth(client);
    try {
      const result = await this.messages.delete(meta.userId, body.messageId);
      // Look up conversation for broadcast
      const msg = await this.prisma.message.findUnique({ where: { id: body.messageId }, select: { conversationId: true } });
      this.send(client, WsServerEvent.MESSAGE_DELETED, result);
      if (msg) {
        this.broadcast(msg.conversationId, client, WsServerEvent.MESSAGE_DELETED, result);
      }
    } catch (e) {
      this.sendError(client, (e as Error).message);
    }
  }

  @SubscribeMessage(WsClientEvent.REACT)
  async onReact(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsReactPayload,
  ): Promise<void> {
    const meta = this.requireAuth(client);
    try {
      const reactions = await this.messages.addReaction(meta.userId, body.messageId, body.emoji);
      const msg = await this.prisma.message.findUnique({ where: { id: body.messageId }, select: { conversationId: true } });
      const payload = { messageId: body.messageId, emoji: body.emoji, userId: meta.userId, reactions };
      this.send(client, WsServerEvent.MESSAGE_REACTION_ADDED, payload);
      if (msg) this.broadcast(msg.conversationId, client, WsServerEvent.MESSAGE_REACTION_ADDED, payload);
    } catch (e) {
      this.sendError(client, (e as Error).message);
    }
  }

  @SubscribeMessage(WsClientEvent.UNREACT)
  async onUnreact(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsReactPayload,
  ): Promise<void> {
    const meta = this.requireAuth(client);
    try {
      const reactions = await this.messages.removeReaction(meta.userId, body.messageId, body.emoji);
      const msg = await this.prisma.message.findUnique({ where: { id: body.messageId }, select: { conversationId: true } });
      const payload = { messageId: body.messageId, emoji: body.emoji, userId: meta.userId, reactions };
      this.send(client, WsServerEvent.MESSAGE_REACTION_REMOVED, payload);
      if (msg) this.broadcast(msg.conversationId, client, WsServerEvent.MESSAGE_REACTION_REMOVED, payload);
    } catch (e) {
      this.sendError(client, (e as Error).message);
    }
  }

  // -------------------------------------------------------------------------
  // Typing + read receipts
  // -------------------------------------------------------------------------

  @SubscribeMessage(WsClientEvent.TYPING_START)
  async onTypingStart(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsTypingPayload,
  ): Promise<void> {
    const meta = this.requireAuth(client);
    const user = await this.prisma.user.findUnique({ where: { id: meta.userId }, select: { fullName: true } });
    this.broadcast(body.conversationId, client, WsServerEvent.TYPING_UPDATE, {
      conversationId: body.conversationId,
      userId: meta.userId,
      fullName: user?.fullName ?? '',
      typing: true,
    });
  }

  @SubscribeMessage(WsClientEvent.TYPING_STOP)
  async onTypingStop(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsTypingPayload,
  ): Promise<void> {
    const meta = this.requireAuth(client);
    this.broadcast(body.conversationId, client, WsServerEvent.TYPING_UPDATE, {
      conversationId: body.conversationId,
      userId: meta.userId,
      typing: false,
    });
  }

  @SubscribeMessage(WsClientEvent.MARK_READ)
  async onMarkRead(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsMarkReadPayload,
  ): Promise<void> {
    const meta = this.requireAuth(client);
    try {
      await this.messages.markRead(meta.userId, body.conversationId, body.lastReadMessageId);
      // Notify other participants that the caller has read up to lastReadMessageId
      this.broadcast(body.conversationId, client, WsServerEvent.READ_RECEIPT, {
        conversationId: body.conversationId,
        userId: meta.userId,
        lastReadMessageId: body.lastReadMessageId,
      });
    } catch (e) {
      this.sendError(client, (e as Error).message);
    }
  }

  // -------------------------------------------------------------------------
  // Push notifications for offline participants (Phase 4)
  // -------------------------------------------------------------------------

  private async queuePushForOfflineParticipants(
    conversationId: string,
    senderId: string,
    message: { id: string; conversationId: string; senderName: string },
  ): Promise<void> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId }, leftAt: null },
      select: { userId: true },
    });

    for (const { userId } of participants) {
      const sockets = this.userSockets.get(userId);
      const hasActiveSocket = sockets && Array.from(sockets).some((s) => s.readyState === 1);
      if (hasActiveSocket) continue;

      await this.notifications.notifyNewMessage(userId, message as any, message.senderName).catch(() => {});
      await this.push.sendToUser(
        userId,
        'message.new',
        'LA Chat',
        `New message from ${message.senderName}`,
        { conversationId, messageId: message.id },
      ).catch(() => {});
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private requireAuth(client: WebSocket): { userId: string; joinedConversations: Set<string> } {
    const meta = this.socketUser.get(client);
    if (!meta) {
      this.send(client, WsServerEvent.ERROR, { code: 'UNAUTHENTICATED', message: 'Socket not authenticated' });
      client.close(1008, 'unauthenticated');
      throw new UnauthorizedException('Socket not authenticated');
    }
    return meta;
  }

  private async assertParticipant(userId: string, conversationId: string): Promise<void> {
    const p = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!p || p.leftAt) {
      throw new ForbiddenException('Not a participant in this conversation');
    }
  }

  private joinRoom(client: WebSocket, conversationId: string): void {
    if (!this.rooms.has(conversationId)) this.rooms.set(conversationId, new Set());
    this.rooms.get(conversationId)!.add(client);
  }

  private leaveRoom(client: WebSocket, conversationId: string): void {
    const room = this.rooms.get(conversationId);
    if (!room) return;
    room.delete(client);
    if (room.size === 0) this.rooms.delete(conversationId);
  }

  /**
   * Send to every socket in a room EXCEPT the sender socket.
   */
  private broadcast(conversationId: string, except: WebSocket, event: WsServerEvent, data: unknown): void {
    const room = this.rooms.get(conversationId);
    if (!room) return;
    const envelope = JSON.stringify({ event, data });
    for (const sock of room) {
      if (sock === except) continue;
      if (sock.readyState === 1 /* OPEN */) sock.send(envelope);
    }
  }

  /**
   * Send to every socket owned by a user EXCEPT the given socket.
   * Used to echo the sender's own message to their other devices.
   */
  private sendToUser(userId: string, except: WebSocket, event: WsServerEvent, data: unknown): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    const envelope = JSON.stringify({ event, data });
    for (const sock of sockets) {
      if (sock === except) continue;
      if (sock.readyState === 1) sock.send(envelope);
    }
  }

  private send(client: WebSocket, event: WsServerEvent, data: unknown): void {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  private sendError(client: WebSocket, message: string): void {
    this.send(client, WsServerEvent.ERROR, { code: 'HANDLER_ERROR', message });
  }
}
