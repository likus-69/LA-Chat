import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDto, NotificationPreferencesDto, NotificationType } from '@la-chat/shared-types';
import type { MessageDto } from '@la-chat/shared-types';
import type { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');

  constructor(private prisma: PrismaService) {}

  async createAndDispatch(
    userId: string,
    type: NotificationType,
    payload: Record<string, unknown>,
  ): Promise<NotificationDto> {
    const notif = await this.prisma.notification.create({
      data: { userId, type, payload: payload as Prisma.InputJsonValue },
    });
    return this.toDto(notif);
  }

  async notifyNewMessage(recipientId: string, message: MessageDto, senderName: string): Promise<void> {
    const prefs = await this.getPreferences(recipientId);
    if (!prefs.enabled) return;

    const typePerType = prefs.perType['message.new'];
    if (typePerType && !typePerType.inApp && !typePerType.push) return;

    if (typePerType?.inApp) {
      await this.createAndDispatch(recipientId, 'message.new', {
        conversationId: message.conversationId,
        messageId: message.id,
        senderName,
      });
    }
  }

  async list(userId: string, opts: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}) {
    const page = opts.page ?? 1;
    const pageSize = Math.min(100, opts.pageSize ?? 20);

    const where = {
      userId,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };

    const [total, unread, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => this.toDto(r)),
      total,
      unread,
      page,
      pageSize,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesDto> {
    const row = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (!row) {
      return {
        enabled: true,
        perType: {
          'message.new': { inApp: true, push: true },
          'announcement.new': { inApp: true, push: true },
          'announcement.ack': { inApp: true, push: false },
          'report.status': { inApp: true, push: true },
          'account.approved': { inApp: true, push: true },
          'account.suspended': { inApp: true, push: true },
          'system': { inApp: true, push: false },
        },
        quietHoursStart: null,
        quietHoursEnd: null,
      };
    }
    return {
      enabled: row.enabled,
      perType: row.perType as unknown as NotificationPreferencesDto['perType'],
      quietHoursStart: row.quietHoursStart,
      quietHoursEnd: row.quietHoursEnd,
    };
  }

  async updatePreferences(userId: string, input: Partial<NotificationPreferencesDto>): Promise<NotificationPreferencesDto> {
    const current = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    const merged = {
      enabled: input.enabled ?? current?.enabled ?? true,
      perType: (input.perType ?? current?.perType ?? {
        'message.new': { inApp: true, push: true },
        'announcement.new': { inApp: true, push: true },
      }) as any,
      quietHoursStart: input.quietHoursStart ?? current?.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? current?.quietHoursEnd ?? null,
    };

    await this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        enabled: merged.enabled,
        perType: merged.perType,
        quietHoursStart: merged.quietHoursStart,
        quietHoursEnd: merged.quietHoursEnd,
      },
      create: {
        userId,
        enabled: merged.enabled,
        perType: merged.perType,
        quietHoursStart: merged.quietHoursStart,
        quietHoursEnd: merged.quietHoursEnd,
      },
    });

    return this.getPreferences(userId);
  }

  async registerPushToken(userId: string, input: { platform: 'ANDROID' | 'IOS' | 'WEB'; token: string; label?: string }): Promise<void> {
    await this.prisma.userDevice.upsert({
      where: { userId_platform_pushToken: { userId, platform: input.platform as any, pushToken: input.token } },
      update: { lastSeenAt: new Date(), label: input.label },
      create: {
        userId,
        platform: input.platform as any,
        pushToken: input.token,
        label: input.label,
      },
    });
  }

  async unregisterPushToken(userId: string, token: string): Promise<void> {
    await this.prisma.userDevice.deleteMany({
      where: { userId, pushToken: token },
    });
  }

  async getPushTokens(userId: string): Promise<{ platform: 'ANDROID' | 'IOS' | 'WEB'; token: string }[]> {
    const devices = await this.prisma.userDevice.findMany({
      where: { userId, pushToken: { not: null } },
      select: { platform: true, pushToken: true },
    });
    return devices
      .filter((d) => d.pushToken !== null)
      .map((d) => ({ platform: d.platform as 'ANDROID' | 'IOS' | 'WEB', token: d.pushToken! }));
  }

  private toDto(notif: {
    id: string;
    type: string;
    payload: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: notif.id,
      type: notif.type as NotificationType,
      payload: notif.payload as Record<string, unknown>,
      readAt: notif.readAt?.toISOString() ?? null,
      createdAt: notif.createdAt.toISOString(),
    };
  }
}
