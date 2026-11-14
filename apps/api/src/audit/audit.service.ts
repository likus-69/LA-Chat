import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogDto } from '@la-chat/shared-types';
import { ListAuditLogsInput } from '@la-chat/validation';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async list(opts: ListAuditLogsInput) {
    const page = opts.page ?? 1;
    const pageSize = Math.min(100, opts.pageSize ?? 50);
    const where = {
      ...(opts.actorId ? { actorId: opts.actorId } : {}),
      ...(opts.action ? { action: { contains: opts.action } } : {}),
      ...(opts.targetType ? { targetType: opts.targetType } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { fullName: true } } },
      }),
    ]);
    return {
      items: rows.map((r) => this.toDto(r as any)),
      total,
      page,
      pageSize,
    };
  }

  private toDto(log: any): AuditLogDto {
    return {
      id: log.id,
      actorId: log.actorId,
      actorName: log.actor?.fullName ?? 'system',
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      ip: log.ip,
      userAgent: log.userAgent,
      at: log.at.toISOString(),
    };
  }
}
