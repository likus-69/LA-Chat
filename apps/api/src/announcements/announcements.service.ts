import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementDto } from '@la-chat/shared-types';
import { CreateAnnouncementInput } from '@la-chat/validation';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, input: CreateAnnouncementInput): Promise<AnnouncementDto> {
    const ann = await this.prisma.announcement.create({
      data: {
        authorId,
        category: input.category as any,
        priority: input.priority as any,
        audience: input.audience as any,
        title: input.title,
        body: input.body,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        targetClassId: input.targetClassId ?? null,
        targetStreamId: input.targetStreamId ?? null,
      },
      include: {
        author: { select: { fullName: true } },
        targetClass: true,
        targetStream: true,
        acknowledgements: { where: { userId: authorId } },
      },
    });
    await this.prisma.auditLog.create({
      data: { actorId: authorId, action: 'announcement.create', targetType: 'announcement', targetId: ann.id },
    });
    return this.toDto(ann as any, authorId);
  }

  async list(callerId: string, opts: { page?: number; pageSize?: number; unacknowledgedOnly?: boolean } = {}) {
    const page = opts.page ?? 1;
    const pageSize = Math.min(100, opts.pageSize ?? 20);
    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      include: { roles: { include: { role: true } }, studentProfile: true },
    });
    if (!caller) throw new NotFoundException('User not found');
    const roleNames = caller.roles.map((r) => r.role.name);
    const isStaff = !roleNames.includes('STUDENT') && !roleNames.includes('PARENT_GUARDIAN');
    const isStudent = roleNames.includes('STUDENT');
    const isParent = roleNames.includes('PARENT_GUARDIAN');
    const where: Prisma.AnnouncementWhereInput = {
      deletedAt: null,
      OR: [
        { audience: 'ALL' as const },
        ...(isStaff ? [{ audience: 'STAFF' as const }, { audience: 'CLASS' as const }, { audience: 'STREAM' as const }, { audience: 'PARENTS' as const }] : []),
        ...(isStudent && caller.studentProfile ? [
          { audience: 'CLASS' as const, targetClassId: caller.studentProfile.classId },
          { audience: 'STREAM' as const, targetStreamId: caller.studentProfile.streamId },
        ] : []),
        ...(isParent ? [{ audience: 'PARENTS' as const }] : []),
      ],
    };
    if (opts.unacknowledgedOnly) {
      where.NOT = { acknowledgements: { some: { userId: callerId } } };
    }
    const [total, rows] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where, orderBy: { publishedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { author: { select: { fullName: true } }, targetClass: true, targetStream: true, acknowledgements: { where: { userId: callerId } } },
      }),
    ]);
    return { items: rows.map((r) => this.toDto(r as any, callerId)), total, page, pageSize };
  }

  async getById(callerId: string, id: string): Promise<AnnouncementDto> {
    const ann = await this.prisma.announcement.findUnique({
      where: { id },
      include: { author: { select: { fullName: true } }, targetClass: true, targetStream: true, acknowledgements: { where: { userId: callerId } } },
    });
    if (!ann || ann.deletedAt) throw new NotFoundException('Announcement not found');
    return this.toDto(ann as any, callerId);
  }

  async delete(authorId: string, id: string): Promise<void> {
    const ann = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ann || ann.deletedAt) throw new NotFoundException('Announcement not found');
    if (ann.authorId !== authorId) {
      const user = await this.prisma.user.findUnique({ where: { id: authorId }, include: { roles: { include: { role: true } } } });
      const isHeadteacher = user?.roles.some((r) => r.role.name === 'HEADTEACHER');
      const isAdmin = user?.roles.some((r) => r.role.name === 'SCHOOL_ADMINISTRATOR');
      if (!isHeadteacher && !isAdmin) throw new ForbiddenException('You can only delete your own announcements');
    }
    await this.prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { actorId: authorId, action: 'announcement.delete', targetType: 'announcement', targetId: id } });
  }

  async acknowledge(userId: string, announcementId: string): Promise<void> {
    const ann = await this.prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!ann || ann.deletedAt) throw new NotFoundException('Announcement not found');
    await this.prisma.announcementAcknowledgement.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      update: {}, create: { announcementId, userId },
    });
  }

  private toDto(ann: any, _callerId: string): AnnouncementDto {
    return {
      id: ann.id, authorId: ann.authorId, authorName: ann.author?.fullName ?? '',
      category: ann.category, priority: ann.priority, audience: ann.audience,
      title: ann.title, body: ann.body,
      publishedAt: ann.publishedAt.toISOString(),
      expiresAt: ann.expiresAt?.toISOString() ?? null,
      targetClassId: ann.targetClassId, targetStreamId: ann.targetStreamId,
      targetClassName: ann.targetClass?.name ?? null,
      targetStreamName: ann.targetStream?.name ?? null,
      acknowledged: ann.acknowledgements.length > 0,
      acknowledgementCount: ann._count?.acknowledgements ?? ann.acknowledgements.length,
      createdAt: ann.createdAt.toISOString(),
    };
  }
}
