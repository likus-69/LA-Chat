import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('stats')
  @Permissions(Permission.USER_EXPORT_CSV, Permission.SYSTEM_AUDIT_READ)
  async getStats() { return this.dashboard.getStats(); }
}
