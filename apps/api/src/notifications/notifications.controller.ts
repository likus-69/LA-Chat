import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { CurrentUser } from '../users/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  registerPushTokenSchema,
  updateNotificationPreferencesSchema,
} from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';
import { AuthedUser } from '../auth/auth.types';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  @Permissions(Permission.USER_READ_SELF)
  async list(
    @CurrentUser() user: AuthedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notifications.list(user.id, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.USER_READ_SELF)
  async markRead(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.markRead(user.id, id);
    return { ok: true };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.USER_READ_SELF)
  async markAllRead(@CurrentUser() user: AuthedUser) {
    await this.notifications.markAllRead(user.id);
    return { ok: true };
  }

  @Get('preferences')
  @Permissions(Permission.USER_READ_SELF)
  async getPreferences(@CurrentUser() user: AuthedUser) {
    return this.notifications.getPreferences(user.id);
  }

  @Patch('preferences')
  @Permissions(Permission.USER_READ_SELF)
  async updatePreferences(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    const parsed = updateNotificationPreferencesSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.notifications.updatePreferences(user.id, parsed.data);
  }

  @Post('push/register')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.USER_READ_SELF)
  async registerPushToken(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    const parsed = registerPushTokenSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    await this.notifications.registerPushToken(user.id, parsed.data);
    return { ok: true };
  }

  @Delete('push/register')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.USER_READ_SELF)
  async unregisterPushToken(@CurrentUser() user: AuthedUser, @Body() body: { token: string }) {
    if (!body?.token) throw new ZodValidationException({ issues: [{ path: ['token'], message: 'token is required', code: 'custom' }] } as any);
    await this.notifications.unregisterPushToken(user.id, body.token);
    return { ok: true };
  }
}
