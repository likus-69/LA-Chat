import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { CurrentUser } from '../users/current-user.decorator';
import { AnnouncementsService } from './announcements.service';
import { createAnnouncementSchema } from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';
import { AuthedUser } from '../auth/auth.types';

@Controller('announcements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}

  @Get()
  @Permissions(Permission.USER_READ_SELF)
  async list(@CurrentUser() user: AuthedUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('unacknowledgedOnly') unacknowledgedOnly?: string) {
    return this.announcements.list(user.id, { page: page ? parseInt(page, 10) : 1, pageSize: pageSize ? parseInt(pageSize, 10) : 20, unacknowledgedOnly: unacknowledgedOnly === 'true' });
  }

  @Get(':id')
  @Permissions(Permission.USER_READ_SELF)
  async getById(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.getById(user.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.ANNOUNCEMENT_PUBLISH_SCHOOL, Permission.ANNOUNCEMENT_PUBLISH_STAFF, Permission.ANNOUNCEMENT_PUBLISH_CLASS, Permission.ANNOUNCEMENT_PUBLISH_STREAM, Permission.ANNOUNCEMENT_PUBLISH_ADMIN)
  async create(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    const parsed = createAnnouncementSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.announcements.create(user.id, parsed.data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.ANNOUNCEMENT_DELETE)
  async delete(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.announcements.delete(user.id, id);
    return { ok: true };
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.USER_READ_SELF)
  async acknowledge(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.announcements.acknowledge(user.id, id);
    return { ok: true };
  }
}
