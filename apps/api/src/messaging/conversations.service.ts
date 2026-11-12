import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationPolicy } from './conversation.policy';
import {
  ConversationDto,
  ConversationListItemDto,
  ConversationParticipantDto,
  MessageDto,
} from '@la-chat/shared-types';
import type { Prisma } from '@prisma/client';
import { MessagesService } from './messages.service';

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private policy: ConversationPolicy,
    private messages: MessagesService,
  ) {}

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  /**
   * Create or return an existing 1-to-1 private conversation between the
   * caller and `participantId`. Idempotent: returns the existing conversation
   * if one already exists.
   */
  async createPrivate(callerId: string, participantId: string): Promise<ConversationDto> {
    await this.policy.assertCanStartPrivate(callerId, participantId);

    // Look for an existing PRIVATE conversation with exactly these two participants.
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'PRIVATE',
        AND: [
          { participants: { some: { userId: callerId } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
      include: { participants: { include: { user: { include: { roles: { include: { role: true } } } } } } },
    });
    if (existing && existing.participants.length === 2) {
      return this.toDto(existing as any, callerId);
    }

    const created = await this.prisma.conversation.create({
      data: {
        type: 'PRIVATE',
        participants: {
          create: [
            { userId: callerId, role: 'MEMBER' },
            { userId: participantId, role: 'MEMBER' },
          ],
        },
      },
      include: { participants: { include: { user: { include: { roles: { include: { role: true } } } } } } },
    });

    return this.toDto(created as any, callerId);
  }

  /**
   * Create a group conversation. The caller becomes ADMIN.
   * Caller must hold conversation.create.group permission (enforced by guard).
   */
  async createGroup(
    callerId: string,
    opts: { name: string; description?: string; participantIds: string[]; groupId?: string },
  ): Promise<ConversationDto> {
    const participantIds = Array.from(new Set([callerId, ...opts.participantIds]));

    // Verify all participants exist and are active.
    const users = await this.prisma.user.findMany({
      where: { id: { in: participantIds }, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (users.length !== participantIds.length) {
      throw new NotFoundException('One or more participants do not exist or are not active');
    }

    const created = await this.prisma.conversation.create({
      data: {
        type: 'GROUP',
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            role: userId === callerId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: { participants: { include: { user: { include: { roles: { include: { role: true } } } } } } },
    });

    // If a groupId was supplied, link the Group to this conversation.
    // (Group owns the FK via conversationId; Conversation has no groupId field.)
    if (opts.groupId) {
      await this.prisma.group.update({
        where: { id: opts.groupId },
        data: { conversationId: created.id },
      }).catch(() => {
        // Group not found — non-fatal; conversation still works.
      });
    }

    return this.toDto(created as any, callerId);
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async list(callerId: string, opts: { page: number; pageSize: number }): Promise<{ items: ConversationListItemDto[]; total: number }> {
    const page = opts.page ?? 1;
    const pageSize = Math.min(100, opts.pageSize ?? 50);

    const where: Prisma.ConversationWhereInput = {
      participants: { some: { userId: callerId, leftAt: null } },
    };

    const [total, rows] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          participants: {
            where: { userId: callerId },
            select: { userId: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            where: { deletedAt: null },
            select: {
              id: true,
              type: true,
              body: true,
              createdAt: true,
              senderId: true,
            },
          },
        },
      }),
    ]);

    // Compute unread counts per conversation in one query.
    const conversationIds = rows.map((r) => r.id);
    const unreadRows = await this.prisma.messageReadReceipt.findMany({
      where: { conversationId: { in: conversationIds }, userId: callerId },
      select: { conversationId: true, lastReadMessageId: true },
    });
    const lastReadMap = new Map(unreadRows.map((r) => [r.conversationId, r.lastReadMessageId]));

    const unreadCounts = await Promise.all(
      rows.map(async (r) => {
        const lastRead = lastReadMap.get(r.id);
        return this.prisma.message.count({
          where: {
            conversationId: r.id,
            senderId: { not: callerId },
            deletedAt: null,
            ...(lastRead ? { id: { gt: lastRead } } : {}),
          },
        });
      }),
    );

    const items: ConversationListItemDto[] = rows.map((r, i) => {
      const lastMsg = r.messages[0];
      const title = r.type === 'PRIVATE' ? null : null; // title resolution for private needs the other party; deferred to detail fetch
      return {
        id: r.id,
        type: r.type as 'PRIVATE' | 'GROUP',
        title,
        lastMessagePreview: lastMsg ? (lastMsg.body ?? `[${lastMsg.type}]`) : null,
        lastMessageAt: lastMsg ? lastMsg.createdAt.toISOString() : null,
        unreadCount: unreadCounts[i],
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    return { items, total };
  }

  async getById(callerId: string, conversationId: string): Promise<ConversationDto> {
    await this.policy.assertIsParticipant(callerId, conversationId);

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { include: { roles: { include: { role: true } } } } },
        },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    return this.toDto(conv as any, callerId);
  }

  // -------------------------------------------------------------------------
  // DTO mapping
  // -------------------------------------------------------------------------

  async toDto(
    conv: {
      id: string;
      type: 'PRIVATE' | 'GROUP';
      groupId: string | null;
      createdAt: Date;
      updatedAt: Date;
      participants: {
        userId: string;
        role: 'MEMBER' | 'ADMIN';
        joinedAt: Date;
        user: { id: string; fullName: string; roles: { role: { name: string } }[] };
      }[];
    },
    callerId: string,
  ): Promise<ConversationDto> {
    const participants: ConversationParticipantDto[] = conv.participants.map((p) => ({
      userId: p.user.id,
      fullName: p.user.fullName,
      role: p.role,
      joinedAt: p.joinedAt.toISOString(),
    }));

    // Title: for PRIVATE, the other party's name; for GROUP, null (group name comes from Group)
    let title: string | null = null;
    if (conv.type === 'PRIVATE') {
      const other = conv.participants.find((p) => p.userId !== callerId);
      title = other?.user.fullName ?? null;
    }

    // Last message + unread count
    const lastMsg = await this.prisma.message.findFirst({
      where: { conversationId: conv.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { reactions: true, attachments: true, sender: true },
    });
    const lastMessage = lastMsg ? this.messages.toDto(lastMsg as any, callerId) : null;

    const receipt = await this.prisma.messageReadReceipt.findUnique({
      where: { conversationId_userId: { conversationId: conv.id, userId: callerId } },
    });
    const lastReadMessageId = receipt?.lastReadMessageId ?? null;

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conv.id,
        senderId: { not: callerId },
        deletedAt: null,
        ...(receipt?.lastReadMessageId ? { id: { gt: receipt.lastReadMessageId } } : {}),
      },
    });

    return {
      id: conv.id,
      type: conv.type,
      title,
      groupId: conv.groupId,
      participants,
      lastMessage,
      lastReadMessageId,
      unreadCount,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    };
  }
}
