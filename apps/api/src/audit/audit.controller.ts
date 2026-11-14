import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { AuditService } from './audit.service';
import { listAuditLogsSchema } from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @Permissions(Permission.SYSTEM_AUDIT_READ)
  async list(
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsed = listAuditLogsSchema.safeParse({
      actorId, action, targetType,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 50,
    });
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.audit.list(parsed.data);
  }
}
