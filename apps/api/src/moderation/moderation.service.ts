import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportDto, AuditLogDto } from '@la-chat/shared-types';
import { CreateReportInput, TakeModerationActionInput, ListAuditLogsInput } from '@la-chat/validation';

@Injectable()
export class ModerationService {
  constructor(private prisma: PrismaService) {}

  async createReport(reporterId: string, input: CreateReportInput): Promise<ReportDto> {
    // If reporting a message, fetch it to get the conversation + sender
    let reportedUserId = input.reportedUserId ?? null;
    if (input.reportedMessageId) {
      const msg = await this.prisma.message.findUnique({
        where: { id: input.reportedMessageId },
        select: { senderId: true },
      });
      if (!msg) throw new NotFoundException('Reported message not found');
      if (!reportedUserId) reportedUserId = msg.senderId;
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedUserId,
        reportedMessageId: input.reportedMessageId ?? null,
        category: input.category as any,
        reason: input.reason,
        status: 'OPEN',
      },
      include: {
        reporter: { select: { fullName: true } },
        reportedUser: { select: { fullName: true } },
        actions: { include: { moderator: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });

    await this.prisma.auditLog.create({
      data: { actorId: reporterId, action: 'report.create', targetType: 'report', targetId: report.id },
    });

    return this.toReportDto(report as any);
  }

  async listReports(opts: { status?: string; page?: number; pageSize?: number } = {}) {
    const page = opts.page ?? 1;
    const pageSize = Math.min(100, opts.pageSize ?? 20);
    const where = {
      ...(opts.status ? { status: opts.status as any } : { status: { not: 'DISMISSED' } }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          reporter: { select: { fullName: true } },
          reportedUser: { select: { fullName: true } },
          actions: { include: { moderator: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } },
        },
      }),
    ]);
    return { items: rows.map((r) => this.toReportDto(r as any)), total, page, pageSize };
  }

  async getReport(reportId: string): Promise<ReportDto> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: { select: { fullName: true } },
        reportedUser: { select: { fullName: true } },
        actions: { include: { moderator: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    return this.toReportDto(report as any);
  }

  async takeAction(moderatorId: string, reportId: string, input: TakeModerationActionInput): Promise<ReportDto> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
      throw new ForbiddenException('This report is already closed');
    }

    const action = await this.prisma.moderationAction.create({
      data: {
        reportId,
        moderatorId,
        action: input.action as any,
        note: input.note ?? null,
      },
    });

    // Execute the action
    let newStatus: string = report.status;
    if (input.action === 'DISMISS') {
      newStatus = 'DISMISSED';
    } else {
      newStatus = 'RESOLVED';
    }

    // If REMOVE_MESSAGE, soft-delete the reported message
    if (input.action === 'REMOVE_MESSAGE' && report.reportedMessageId) {
      await this.prisma.message.update({
        where: { id: report.reportedMessageId },
        data: { deletedAt: new Date(), body: null },
      });
    }

    // If SUSPEND_ACCOUNT, suspend the reported user
    if (input.action === 'SUSPEND_ACCOUNT' && report.reportedUserId) {
      await this.prisma.user.update({
        where: { id: report.reportedUserId },
        data: { status: 'SUSPENDED' },
      });
      // Revoke their sessions
      await this.prisma.userSession.updateMany({
        where: { userId: report.reportedUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { status: newStatus as any, resolvedAt: newStatus === 'RESOLVED' || newStatus === 'DISMISSED' ? new Date() : null },
      include: {
        reporter: { select: { fullName: true } },
        reportedUser: { select: { fullName: true } },
        actions: { include: { moderator: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });

    await this.prisma.auditLog.create({
      data: { actorId: moderatorId, action: `moderation.${input.action.toLowerCase()}`, targetType: 'report', targetId: reportId },
    });

    return this.toReportDto(updated as any);
  }

  async viewReportedMessage(moderatorId: string, reportId: string): Promise<{ message: any; accessLogged: boolean }> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (!report.reportedMessageId) {
      throw new NotFoundException('No message associated with this report');
    }

    // Log the access — this is the append-only moderation_access_log
    await this.prisma.moderationAccessLog.create({
      data: {
        moderatorId,
        messageId: report.reportedMessageId,
        reason: `Viewing reported message (report ${reportId}: ${report.category})`,
      },
    });

    // Fetch the message with full context
    const msg = await this.prisma.message.findUnique({
      where: { id: report.reportedMessageId },
      include: {
        sender: { select: { fullName: true } },
        conversation: { select: { id: true, type: true } },
        reactions: true,
        attachments: true,
      },
    });

    return { message: msg, accessLogged: true };
  }

  private toReportDto(report: any): ReportDto {
    return {
      id: report.id,
      reporterId: report.reporterId,
      reporterName: report.reporter?.fullName ?? '',
      reportedUserId: report.reportedUserId,
      reportedUserName: report.reportedUser?.fullName ?? null,
      reportedMessageId: report.reportedMessageId,
      category: report.category,
      reason: report.reason,
      status: report.status,
      actions: (report.actions ?? []).map((a: any) => ({
        id: a.id,
        moderatorName: a.moderator?.fullName ?? '',
        action: a.action,
        note: a.note,
        createdAt: a.createdAt.toISOString(),
      })),
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
    };
  }
}
