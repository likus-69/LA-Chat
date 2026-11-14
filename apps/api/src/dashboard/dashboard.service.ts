import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardStatsDto } from '@la-chat/shared-types';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(): Promise<DashboardStatsDto> {
    const [totalStudents, totalTeachers, totalActive, totalSuspended, totalPending, totalGroups, totalConversations, totalAnnouncements, recentAnnouncements, recentActivity] = await Promise.all([
      this.prisma.user.count({ where: { roles: { some: { role: { name: 'STUDENT' } } }, deletedAt: null } }),
      this.prisma.user.count({ where: { roles: { some: { role: { name: { in: ['TEACHER', 'CLASS_TEACHER', 'HEADTEACHER', 'DEPUTY_HEADTEACHER'] } } } }, deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'PENDING', deletedAt: null } }),
      this.prisma.group.count(),
      this.prisma.conversation.count(),
      this.prisma.announcement.count({ where: { deletedAt: null } }),
      this.prisma.announcement.findMany({ where: { deletedAt: null }, orderBy: { publishedAt: 'desc' }, take: 5, include: { author: { select: { fullName: true } } } }),
      this.prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: 10, include: { actor: { select: { fullName: true } } } }),
    ]);
    return {
      totalStudents, totalTeachers, totalActiveAccounts: totalActive, totalSuspended, totalPending,
      totalGroups, totalConversations, totalAnnouncements,
      recentAnnouncements: recentAnnouncements.map((a) => ({ id: a.id, title: a.title, authorName: a.author?.fullName ?? '', publishedAt: a.publishedAt.toISOString() })),
      recentActivity: recentActivity.map((log) => ({ action: log.action, actorName: log.actor?.fullName ?? 'system', at: log.at.toISOString() })),
    };
  }
}
