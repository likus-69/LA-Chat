import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { CurrentUser } from '../users/current-user.decorator';
import { ModerationService } from './moderation.service';
import { createReportSchema, takeModerationActionSchema } from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';
import { AuthedUser } from '../auth/auth.types';

@Controller('moderation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModerationController {
  constructor(private moderation: ModerationService) {}

  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.REPORT_CREATE)
  async createReport(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.moderation.createReport(user.id, parsed.data);
  }

  @Get('reports')
  @Permissions(Permission.REPORT_REVIEW)
  async listReports(@Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.moderation.listReports({
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get('reports/:id')
  @Permissions(Permission.REPORT_REVIEW)
  async getReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderation.getReport(id);
  }

  @Post('reports/:id/action')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.REPORT_REVIEW)
  async takeAction(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const parsed = takeModerationActionSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.moderation.takeAction(user.id, id, parsed.data);
  }

  @Get('reports/:id/message')
  @Permissions(Permission.MODERATION_ACCESS_PRIVATE)
  async viewReportedMessage(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.moderation.viewReportedMessage(user.id, id);
  }
}
