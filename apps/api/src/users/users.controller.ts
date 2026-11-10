import {
  Body,
  Controller,
  Get,
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
import { Permission, RoleName, AccountStatus } from '@la-chat/shared-types';
import { CurrentUser } from './current-user.decorator';
import { UsersService } from './users.service';
import { suspendUserSchema, updateProfileSchema } from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';
import { AuthedUser } from '../auth/auth.types';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  @Permissions(Permission.USER_READ_SELF)
  async me(@CurrentUser() user: AuthedUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  @Permissions(Permission.USER_UPDATE_SELF)
  async updateMe(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    // Update via prisma directly here for now; in a later phase this moves
    // into the service.
    return null; // placeholder — full impl in Phase 2 follow-up
  }

  @Get()
  @Permissions(Permission.USER_READ_STUDENTS, Permission.USER_READ_STAFF)
  async list(
    @Query('role') role?: RoleName,
    @Query('status') status?: AccountStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.users.list({
      role,
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post(':id/approve')
  @Permissions(Permission.USER_UPDATE_OTHERS)
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthedUser) {
    return this.users.approve(id, actor.id);
  }

  @Post(':id/suspend')
  @Permissions(Permission.USER_SUSPEND)
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthedUser,
    @Body() body: unknown,
  ) {
    const parsed = suspendUserSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.users.suspend(id, parsed.data.reason, actor.id);
  }

  @Post(':id/restore')
  @Permissions(Permission.USER_RESTORE)
  async restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthedUser) {
    return this.users.restore(id, actor.id);
  }
}
