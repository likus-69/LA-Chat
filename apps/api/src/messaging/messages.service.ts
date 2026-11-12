import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationPolicy } from './conversation.policy';
import {
  MessageDto,
  MessageReactionDto,
  MessageAttachmentDto,
} from '@la-chat/shared-types';

export interface SendMessageArgs {
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'DOCUMENT';
  body?: string;
  replyToId?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private policy: ConversationPolicy,
  ) {}

  // -------------------------------------------------------------------------
  // Send (idempotent on (conversationId, clientMessageId))
  // -------------------------------------------------------------------------

  async send(args: SendMessageArgs): Promise<{ message: MessageDto; created: boolean }> {
    const { conversationId, senderId, clientMessageId } = args;

    // Idempotency: if a message with this clientMessageId already exists in this
    // conversation, return it without creating a duplicate.
    const existing = await this.prisma.message.findUnique({
      where: {
        conversationId_clientMessageId: { conversationId, clientMessageId },
      },
      include: { reactions: true, attachments: true, sender: true, replyTo: { include: { sender: true } } },
    });
    if (existing) {
      return { message: this.toDto(existing as any, senderId), created: false };
    }

    // Permission: sender must be a participant
    await this.policy.assertIsParticipant(senderId, conversationId);

    // Body / type validation: TEXT must have a body; media types will require an attachment (Phase 4)
    const type = args.type ?? 'TEXT';
    if (type === 'TEXT' && (!args.body || args.body.trim().length === 0)) {
      throw new ForbiddenException('TEXT messages must have a non-empty body');
    }

    // Validate reply target if provided
    if (args.replyToId) {
      const reply = await this.prisma.message.findUnique({ where: { id: args.replyToId } });
      if (!reply || reply.conversationId !== conversationId) {
        throw new NotFoundException('Reply target message not found in this conversation');
      }
    }

    const created = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        clientMessageId,
        type,
        body: args.body ?? null,
        replyToId: args.replyToId ?? null,
      },
      include: { reactions: true, attachments: true, sender: true, replyTo: { include: { sender: true } } },
    });

    // Update conversation's lastMessageAt
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: created.createdAt },
    });

    // Create delivery-status rows for every other participant (state = SENT).
    const otherParticipants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId }, leftAt: null },
      select: { userId: true },
    });
    if (otherParticipants.length > 0) {
      await this.prisma.messageDeliveryStatus.createMany({
        data: otherParticipants.map((p) => ({
          messageId: created.id,
          recipientId: p.userId,
          state: 'SENT',
        })),
      });
    }

    return { message: this.toDto(created as any, senderId), created: true };
  }

  // -------------------------------------------------------------------------
  // List (cursor pagination, newest first then reverse for display)
  // -------------------------------------------------------------------------

  async list(
    callerId: string,
    conversationId: string,
    opts: { before?: string; limit?: number },
  ): Promise<{ items: MessageDto[]; hasMore: boolean; nextCursor: string | null }> {
    await this.policy.assertIsParticipant(callerId, conversationId);

    const limit = Math.min(100, opts.limit ?? 50);
    const where = {
      conversationId,
      deletedAt: null,
      ...(opts.before ? { id: { lt: opts.before } } : {}),
    };

    // Order by createdAt DESC so we can paginate backwards; the client reverses for display.
    const rows = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        reactions: true,
        attachments: true,
        sender: true,
        replyTo: { include: { sender: true } },
      },
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => this.toDto(r as any, callerId));
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { items, hasMore, nextCursor };
  }

  // -------------------------------------------------------------------------
  // Edit (own messages only)
  // -------------------------------------------------------------------------

  async edit(callerId: string, messageId: string, body: string): Promise<MessageDto> {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { reactions: true, attachments: true, sender: true, replyTo: { include: { sender: true } } },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== callerId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    if (msg.deletedAt) {
      throw new ForbiddenException('Cannot edit a deleted message');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
      include: { reactions: true, attachments: true, sender: true, replyTo: { include: { sender: true } } },
    });

    return this.toDto(updated as any, callerId);
  }

  // -------------------------------------------------------------------------
  // Delete (own messages; soft-delete)
  // -------------------------------------------------------------------------

  async delete(callerId: string, messageId: string): Promise<{ id: string; deletedAt: string }> {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== callerId) {
      // Moderators with message.delete.others can also delete — but that path
      // goes through the moderation module (Phase 6), not here.
      throw new ForbiddenException('You can only delete your own messages');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: null },
    });

    return { id: updated.id, deletedAt: updated.deletedAt!.toISOString() };
  }

  // -------------------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------------------

  async addReaction(callerId: string, messageId: string, emoji: string): Promise<MessageReactionDto[]> {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.policy.assertIsParticipant(callerId, msg.conversationId);

    try {
      await this.prisma.messageReaction.create({
        data: { messageId, userId: callerId, emoji },
      });
    } catch {
      // unique constraint — already reacted with this emoji, idempotent success
    }

    return this.getReactionsForMessage(messageId);
  }

  async removeReaction(callerId: string, messageId: string, emoji: string): Promise<MessageReactionDto[]> {
    await this.prisma.messageReaction.delete({
      where: { messageId_userId_emoji: { messageId, userId: callerId, emoji } },
    }).catch(() => null);
    return this.getReactionsForMessage(messageId);
  }

  private async getReactionsForMessage(messageId: string): Promise<MessageReactionDto[]> {
    const rows = await this.prisma.messageReaction.findMany({
      where: { messageId },
      include: { user: { select: { fullName: true } } },
    });
    return rows.map((r) => ({
      emoji: r.emoji,
      userId: r.userId,
      fullName: r.user.fullName,
    }));
  }

  // -------------------------------------------------------------------------
  // Read receipts + delivery status
  // -------------------------------------------------------------------------

  async markRead(callerId: string, conversationId: string, lastReadMessageId: string): Promise<void> {
    await this.policy.assertIsParticipant(callerId, conversationId);

    // Upsert the read receipt watermark
    await this.prisma.messageReadReceipt.upsert({
      where: { conversationId_userId: { conversationId, userId: callerId } },
      update: { lastReadMessageId, lastReadAt: new Date() },
      create: { conversationId, userId: callerId, lastReadMessageId, lastReadAt: new Date() },
    });

    // Update delivery-status rows for messages up to lastReadMessageId from other senders → READ
    await this.prisma.messageDeliveryStatus.updateMany({
      where: {
        recipientId: callerId,
        message: { conversationId, id: { lte: lastReadMessageId } },
        state: { not: 'READ' },
      },
      data: { state: 'READ', at: new Date() },
    });
  }

  /**
   * When a client connects via WebSocket, mark all undelivered messages as
   * DELIVERED for that user.
   */
  async markDeliveredOnConnect(userId: string): Promise<void> {
    await this.prisma.messageDeliveryStatus.updateMany({
      where: { recipientId: userId, state: 'SENT' },
      data: { state: 'DELIVERED', at: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Search (LIKE-based for now; tsvector upgrade in Phase 6)
  // -------------------------------------------------------------------------

  async search(
    callerId: string,
    query: string,
    opts: { conversationId?: string; page: number; pageSize: number },
  ): Promise<{ items: MessageDto[]; total: number }> {
    const page = opts.page ?? 1;
    const pageSize = Math.min(50, opts.pageSize ?? 20);

    // Only search in conversations the caller is a participant in.
    const visibleConversations = await this.prisma.conversationParticipant.findMany({
      where: { userId: callerId, leftAt: null },
      select: { conversationId: true },
    });
    const visibleIds = visibleConversations.map((v) => v.conversationId);
    if (visibleIds.length === 0) return { items: [], total: 0 };

    const where = {
      body: { contains: query, mode: 'insensitive' as const },
      deletedAt: null,
      conversationId: opts.conversationId
        ? opts.conversationId
        : { in: visibleIds },
      ...(opts.conversationId ? { conversationId: opts.conversationId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          reactions: true,
          attachments: true,
          sender: true,
          replyTo: { include: { sender: true } },
        },
      }),
    ]);

    // If a specific conversationId was passed, verify participation.
    if (opts.conversationId && !visibleIds.includes(opts.conversationId)) {
      throw new ForbiddenException('You cannot search in a conversation you are not part of');
    }

    const items = rows.map((r) => this.toDto(r as any, callerId));
    return { items, total };
  }

  // -------------------------------------------------------------------------
  // DTO mapping
  // -------------------------------------------------------------------------

  toDto(
    msg: {
      id: string;
      conversationId: string;
      senderId: string;
      clientMessageId: string;
      type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'DOCUMENT' | 'SYSTEM';
      body: string | null;
      editedAt: Date | null;
      deletedAt: Date | null;
      createdAt: Date;
      sender: { id: string; fullName: string };
      reactions: { emoji: string; userId: string; user: { fullName: string } }[];
      attachments: {
        id: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
      }[];
      replyTo: {
        id: string;
        body: string | null;
        sender: { id: string; fullName: string };
      } | null;
    },
    callerId: string,
  ): MessageDto {
    const reactions: MessageReactionDto[] = msg.reactions.map((r) => ({
      emoji: r.emoji,
      userId: r.userId,
      fullName: r.user?.fullName ?? '',
    }));

    const attachments: MessageAttachmentDto[] = msg.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      signedUrl: null, // Phase 4 — signed URLs come with media support
    }));

    const replyTo = msg.replyTo
      ? {
          id: msg.replyTo.id,
          senderName: msg.replyTo.sender?.fullName ?? '',
          bodyPreview: (msg.replyTo.body ?? '').slice(0, 120),
        }
      : null;

    // Delivery state from caller's perspective: sender sees null; recipient sees their state.
    let myDeliveryState: 'SENT' | 'DELIVERED' | 'READ' | null = null;
    if (msg.senderId !== callerId) {
      // We don't have the per-caller delivery row on this DTO; the WebSocket
      // gateway emits separate delivery events. REST callers see 'DELIVERED'
      // as a safe default for messages they didn't send.
      myDeliveryState = 'DELIVERED';
    }

    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.sender?.fullName ?? '',
      clientMessageId: msg.clientMessageId,
      type: msg.type,
      body: msg.body,
      replyTo,
      reactions,
      attachments,
      editedAt: msg.editedAt?.toISOString() ?? null,
      deletedAt: msg.deletedAt?.toISOString() ?? null,
      createdAt: msg.createdAt.toISOString(),
      myDeliveryState,
    };
  }
}
